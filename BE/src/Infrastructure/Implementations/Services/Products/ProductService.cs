using Application.Common.Exceptions;
using Application.Common.Models;
using Application.DTOs.Products;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Products;
using Application.Interfaces.Services.Roles;
using Application.Mappings.Products;
using Domain.Common;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.ProductGroups;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Inventory.Stock;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Products;

/// <summary>
/// Mặt hàng, đơn vị quy đổi, mã vạch (UC-01, FR-04..FR-07, BR-01..BR-04, BR-29, 07 §2.2). 300 mặt hàng nên danh sách lọc,
/// sắp, phân trang trong bộ nhớ (trường suy ra như biên lãi, trạng thái tồn sắp được).
/// </summary>
public sealed class ProductService(
    IGenericRepository<Product> products,
    IGenericRepository<ProductUnit> units,
    IGenericRepository<ProductGroup> groups,
    IGenericRepository<OrderLine> orderLines,
    IGenericRepository<GoodsReceiptLine> receiptLines,
    IGenericRepository<StockMovement> movements,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IPermissionService permissionService) : IProductService
{
    public const string CodePrefix = "SP";

    private readonly PosAccess _access = new(currentUser, permissionService);

    public async Task<PaginatedResult<ProductDto>> GetPagedAsync(ProductQuery query, CancellationToken ct = default)
    {
        var canViewCost = await _access.CanViewCostAsync(ct);
        var source = products.QueryNoTracking().Include(p => p.Group).Include(p => p.Units).AsSplitQuery();
        if (query.GroupId is { } groupId)
            source = source.Where(p => p.GroupId == groupId);
        if (query.Status is { } status)
            source = source.Where(p => p.Status == status);

        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(VietnameseText.Normalize(term));
            var raw = term.Trim();
            source = source.Where(p => AppDbFunctions.Matches(p.NameSearch, pattern)
                || AppDbFunctions.Matches(p.Code, LikePattern.Contains(raw))
                || p.Units.Any(u => u.Barcode == raw));
        }

        var list = await source.ToListAsync(ct);
        IEnumerable<Product> filtered = list;
        if (query.StockStatus is { } stockStatus)
            filtered = filtered.Where(p => p.StockStatus == stockStatus);
        if (query.LowMargin is { } lowMargin && canViewCost)
            filtered = filtered.Where(p => StockMath.IsLowMargin(StockMath.MarginPct(p.BaseUnit.Price, p.AvgCost)) == lowMargin);

        var documented = await DocumentedProductIdsAsync(ct);
        var dtos = filtered.Select(p => p.ToDto(canViewCost, documented.Contains(p.Id)));
        dtos = Sort(dtos, query, canViewCost);

        var all = dtos.ToList();
        var page = query.GetPage();
        var size = query.GetPageSize();
        return new PaginatedResult<ProductDto>
        {
            Items = all.Skip((page - 1) * size).Take(size).ToList(),
            Page = page,
            PageSize = size,
            TotalCount = all.Count
        };
    }

    public async Task<ProductDto> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await ToDtoAsync(await LoadAsync(id, tracking: false, ct), ct);

    public async Task<ProductLookupDto> LookupAsync(string barcode, CancellationToken ct = default)
    {
        var code = barcode.Trim();
        var unit = await units.QueryNoTracking().FirstOrDefaultAsync(u => u.Barcode == code, ct);
        var product = unit is null ? null : await products.QueryNoTracking().Include(p => p.Group).Include(p => p.Units)
            .FirstOrDefaultAsync(p => p.Id == unit.ProductId, ct);
        if (unit is null || product is null)
            throw new NotFoundException($"Không tìm thấy mã vạch {code}");

        return new ProductLookupDto { Product = await ToDtoAsync(product, ct), UnitId = unit.Id };
    }

    public async Task<ProductDto> CreateAsync(SaveProductRequest request, CancellationToken ct = default)
    {
        EnsurePricesAndFactors(request);
        var group = await groups.QueryNoTracking().FirstOrDefaultAsync(g => g.Id == request.GroupId, ct)
            ?? throw FieldErrors.Single("groupId", "Nhóm hàng không tồn tại");
        await EnsureBarcodesAsync(request, null, ct);

        var codes = await products.QueryNoTracking().IgnoreQueryFilters().Select(p => p.Code).ToListAsync(ct);
        var product = Product.Create(
            DocCodes.NextSequential(codes, CodePrefix, 5),
            request.Name,
            request.GroupId,
            request.MinStock,
            request.TrackExpiry,
            request.Returnable,
            request.Status,
            request.ImageUrl,
            string.IsNullOrWhiteSpace(request.Color) ? group.Color : request.Color,
            request.InitialCost ?? 0);
        product.AddUnit(request.BaseUnit, 1, request.Barcode, request.Price, isBase: true, sortOrder: 0);
        for (var i = 0; i < request.Units.Count; i++)
        {
            var input = request.Units[i];
            product.AddUnit(input.Name, input.Factor, input.Barcode, input.Price, isBase: false, sortOrder: i + 1);
        }

        await products.AddAsync(product, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(product.Id, ct);
    }

    public async Task<ProductDto> UpdateAsync(Guid id, SaveProductRequest request, CancellationToken ct = default)
    {
        EnsurePricesAndFactors(request);
        var product = await LoadAsync(id, tracking: true, ct);
        if (!await groups.AnyAsync(g => g.Id == request.GroupId, ct))
            throw FieldErrors.Single("groupId", "Nhóm hàng không tồn tại");
        await EnsureBarcodesAsync(request, id, ct);

        var conversions = product.Units.Where(u => !u.IsBase).ToList();

        // BR-29: đơn vị đã có chứng từ không xóa, không đổi hệ số.
        for (var i = 0; i < request.Units.Count; i++)
        {
            var input = request.Units[i];
            if (input.Id is { } unitId && conversions.FirstOrDefault(u => u.Id == unitId) is { EverUsed: true } used && used.Factor != input.Factor)
                throw PosErrors.Create(PosErrors.DonViDaDung, PosErrors.UnitUsedMessage(used.Name), $"units[{i}].factor");
        }

        foreach (var unit in conversions.Where(u => request.Units.All(x => x.Id != u.Id)))
        {
            if (unit.EverUsed)
                throw PosErrors.Create(PosErrors.DonViDaDung, PosErrors.UnitUsedMessage(unit.Name), "units");
            product.RemoveUnit(unit);
            units.Delete(unit);
        }

        product.Update(request.Name, request.GroupId, request.MinStock, request.TrackExpiry, request.Returnable, request.Status, request.ImageUrl,
            string.IsNullOrWhiteSpace(request.Color) ? product.Color : request.Color);
        product.BaseUnit.Update(request.BaseUnit, 1, request.Barcode, request.Price, 0);
        for (var i = 0; i < request.Units.Count; i++)
        {
            var input = request.Units[i];
            var existing = input.Id is { } unitId ? conversions.FirstOrDefault(u => u.Id == unitId) : null;
            if (existing is not null)
                existing.Update(input.Name, input.Factor, input.Barcode, input.Price, i + 1);
            else
                await units.AddAsync(product.AddUnit(input.Name, input.Factor, input.Barcode, input.Price, isBase: false, sortOrder: i + 1), ct);
        }

        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task SetStatusAsync(Guid id, ProductStatusRequest request, CancellationToken ct = default)
    {
        var product = await products.Query().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NotFoundException("Không tìm thấy mặt hàng");
        product.SetStatus(request.Status);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<ProductDto> UpdatePricesAsync(Guid id, UpdateProductPricesRequest request, CancellationToken ct = default)
    {
        var product = await LoadAsync(id, tracking: true, ct);
        for (var i = 0; i < request.Prices.Count; i++)
        {
            if (!IsPriceValid(request.Prices[i].Price))
                throw PosErrors.Create(PosErrors.GiaKhongHopLe, PosErrors.InvalidPriceMessage, $"prices[{i}].price");

            var unit = product.Units.FirstOrDefault(u => u.Id == request.Prices[i].UnitId)
                ?? throw FieldErrors.Single($"prices[{i}].unitId", "Đơn vị không thuộc mặt hàng");
            unit.SetPrice(request.Prices[i].Price);
        }

        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var product = await products.Query().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NotFoundException("Không tìm thấy mặt hàng");
        if (await HasDocumentsAsync(id, ct))
            throw PosErrors.Create(PosErrors.HangDaCoChungTu, PosErrors.ProductHasDocumentsMessage);
        products.Delete(product);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<InternalBarcodeDto> NextInternalBarcodeAsync(CancellationToken ct = default)
    {
        var prefix = PosRules.InternalBarcodePrefix;
        var codes = await units.QueryNoTracking().Where(u => u.Barcode != null && u.Barcode.StartsWith(prefix)).Select(u => u.Barcode).ToListAsync(ct);
        return new InternalBarcodeDto { Barcode = Barcodes.NextInternal(codes) };
    }

    private static bool IsPriceValid(decimal price) => price > 0 && price % PosRules.PriceStep == 0;

    /// <summary>Giá bội số 500 (BR-04), hệ số 2–1.000, tối đa 3 đơn vị quy đổi (BR-01, FR-05); lỗi kèm mã 07 §2.12.</summary>
    private static void EnsurePricesAndFactors(SaveProductRequest request)
    {
        if (!IsPriceValid(request.Price))
            throw PosErrors.Create(PosErrors.GiaKhongHopLe, PosErrors.InvalidPriceMessage, "price");
        if (request.Units.Count > PosRules.MaxConversionUnits)
            throw PosErrors.Create(PosErrors.DonViQuyDoiKhongHopLe, PosErrors.TooManyUnitsMessage, "units");
        for (var i = 0; i < request.Units.Count; i++)
        {
            if (request.Units[i].Factor is < PosRules.MinFactor or > PosRules.MaxFactor)
                throw PosErrors.Create(PosErrors.DonViQuyDoiKhongHopLe, PosErrors.InvalidFactorMessage, $"units[{i}].factor");
            if (!IsPriceValid(request.Units[i].Price))
                throw PosErrors.Create(PosErrors.GiaKhongHopLe, PosErrors.InvalidPriceMessage, $"units[{i}].price");
        }
    }

    private async Task<Product> LoadAsync(Guid id, bool tracking, CancellationToken ct)
    {
        var query = tracking ? products.Query() : products.QueryNoTracking();
        return await query.Include(p => p.Group).Include(p => p.Units).AsSplitQuery().FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy mặt hàng");
    }

    private async Task<ProductDto> ToDtoAsync(Product product, CancellationToken ct) =>
        product.ToDto(await _access.CanViewCostAsync(ct), await HasDocumentsAsync(product.Id, ct));

    private async Task<bool> HasDocumentsAsync(Guid productId, CancellationToken ct) =>
        await orderLines.AnyAsync(l => l.ProductId == productId, ct)
        || await receiptLines.AnyAsync(l => l.ProductId == productId, ct)
        || await movements.AnyAsync(m => m.ProductId == productId && m.Type != MovementType.TonDau, ct);

    private async Task<HashSet<Guid>> DocumentedProductIdsAsync(CancellationToken ct)
    {
        var ids = new HashSet<Guid>(await movements.QueryNoTracking().Where(m => m.Type != MovementType.TonDau).Select(m => m.ProductId).Distinct().ToListAsync(ct));
        ids.UnionWith(await receiptLines.QueryNoTracking().Select(l => l.ProductId).Distinct().ToListAsync(ct));
        ids.UnionWith(await orderLines.QueryNoTracking().Select(l => l.ProductId).Distinct().ToListAsync(ct));
        return ids;
    }

    /// <summary>Mã vạch duy nhất trên mọi đơn vị, mọi mặt hàng kể cả ngừng bán, đã xóa mềm, và trong chính request (TC-02).</summary>
    private async Task EnsureBarcodesAsync(SaveProductRequest request, Guid? productId, CancellationToken ct)
    {
        var entries = new List<(string Field, string Code, string UnitName)>();
        if (!string.IsNullOrWhiteSpace(request.Barcode))
            entries.Add(("barcode", request.Barcode.Trim(), request.BaseUnit.Trim()));
        for (var i = 0; i < request.Units.Count; i++)
        {
            if (!string.IsNullOrWhiteSpace(request.Units[i].Barcode))
                entries.Add(($"units[{i}].barcode", request.Units[i].Barcode!.Trim(), request.Units[i].Name.Trim()));
        }

        if (entries.Count == 0)
            return;

        var seen = new Dictionary<string, string>();
        foreach (var (field, code, unitName) in entries)
        {
            if (seen.TryGetValue(code, out var firstUnit))
                throw Duplicate(field, request.Name.Trim(), firstUnit);
            seen[code] = unitName;
        }

        var codes = entries.Select(e => e.Code).ToList();
        var taken = await units.QueryNoTracking()
            .Where(u => u.Barcode != null && codes.Contains(u.Barcode) && (productId == null || u.ProductId != productId))
            .Select(u => new { u.Barcode, u.Name, u.ProductId })
            .ToListAsync(ct);
        foreach (var (field, code, _) in entries)
        {
            var hit = taken.FirstOrDefault(t => t.Barcode == code);
            if (hit is null)
                continue;
            var owner = await products.QueryNoTracking().IgnoreQueryFilters().Where(p => p.Id == hit.ProductId).Select(p => p.Name).FirstAsync(ct);
            throw Duplicate(field, owner, hit.Name);
        }
    }

    private static ConflictException Duplicate(string field, string productName, string unitName) =>
        new(PosErrors.BarcodeUsedMessage(productName, unitName), field, new Dictionary<string, object?> { ["code"] = PosErrors.MaVachDaDung });

    private static IEnumerable<ProductDto> Sort(IEnumerable<ProductDto> items, ProductQuery query, bool canViewCost)
    {
        var desc = !string.IsNullOrWhiteSpace(query.SortDir) && query.IsDescending();
        Func<ProductDto, object?> key = (query.SortBy ?? "code").Trim().ToLowerInvariant() switch
        {
            "name" => p => p.Name,
            "groupname" => p => p.GroupName,
            "price" => p => p.Price,
            "avgcost" when canViewCost => p => p.AvgCost,
            "marginpct" when canViewCost => p => p.MarginPct,
            "stock" => p => p.Stock,
            "minstock" => p => p.MinStock,
            "createdat" => p => p.CreatedAt,
            "status" => p => p.Status,
            _ => p => p.Code
        };
        return desc ? items.OrderByDescending(key).ThenBy(p => p.Code) : items.OrderBy(key).ThenBy(p => p.Code);
    }
}
