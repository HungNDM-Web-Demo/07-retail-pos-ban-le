using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Common.Time;
using Application.DTOs.GoodsReceipts;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.GoodsReceipts;
using Application.Interfaces.Services.Roles;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.Suppliers;
using Domain.Entities.Pos;
using Domain.Entities.System.Users;
using Domain.Enums.Inventory.GoodsReceipts;
using Domain.Enums.Inventory.Stock;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Common;
using Infrastructure.Implementations.Services.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.GoodsReceipts;

/// <summary>
/// Phiếu nhập (UC-14, BR-23, BR-24, 07 §2.9): nháp sửa, xóa được, không bắt HSD; xác nhận nhập kho tính giá vốn bình quân
/// lần lượt từng dòng, tăng tồn, ghi sổ biến động, trả danh sách hàng có biên lãi dưới 5% sau nhập (TC-40).
/// </summary>
public sealed class GoodsReceiptService(
    IGenericRepository<GoodsReceipt> receipts,
    IGenericRepository<Supplier> suppliers,
    IGenericRepository<Product> products,
    IGenericRepository<ProductUnit> units,
    IGenericRepository<StockMovement> movements,
    IGenericRepository<User> users,
    IUnitOfWork unitOfWork,
    IPosTransaction transaction,
    ICurrentUserService currentUser,
    IPermissionService permissionService,
    TimeProvider timeProvider) : IGoodsReceiptService
{
    public const string CodePrefix = "PN";

    private readonly PosAccess _access = new(currentUser, permissionService);

    private DateTime Now => timeProvider.GetUtcNow().UtcDateTime;

    public async Task<PaginatedResult<GoodsReceiptListItem>> GetPagedAsync(GoodsReceiptQuery query, CancellationToken ct = default)
    {
        var source = receipts.QueryNoTracking().Include(r => r.Supplier).Include(r => r.Lines).AsSplitQuery();
        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(r => AppDbFunctions.Matches(r.Code, pattern) || AppDbFunctions.Matches(r.Supplier!.Name, pattern));
        }

        if (query.Status is { } status)
            source = source.Where(r => r.Status == status);
        if (query.SupplierId is { } supplierId)
            source = source.Where(r => r.SupplierId == supplierId);
        if (VietnamDates.TryParse(query.From, out var from))
            source = source.Where(r => r.ReceivedDate >= from);
        if (VietnamDates.TryParse(query.To, out var to))
            source = source.Where(r => r.ReceivedDate <= to);

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        return page.Map(items => items.Select(r => new GoodsReceiptListItem
        {
            Id = r.Id,
            Code = r.Code,
            SupplierId = r.SupplierId,
            SupplierName = r.Supplier?.Name ?? string.Empty,
            Status = r.Status,
            ReceivedDate = r.ReceivedDate,
            ConfirmedAt = r.ConfirmedAt,
            LineCount = r.Lines.Count,
            TotalAmount = r.TotalAmount
        }).ToList());
    }

    public async Task<GoodsReceiptDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var receipt = await receipts.QueryNoTracking()
            .Include(r => r.Supplier)
            .Include(r => r.Lines).ThenInclude(l => l.Product)
            .AsSplitQuery()
            .FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy phiếu nhập");
        return ToDto(receipt);
    }

    public async Task<GoodsReceiptDto> CreateAsync(SaveGoodsReceiptRequest request, CancellationToken ct = default)
    {
        await EnsureSupplierAsync(request.SupplierId, ct);
        var now = Now;
        var createdBy = await _access.FullNameAsync(users, ct);
        var code = await DocCodes.NextAsync(receipts.QueryNoTracking().Select(r => r.Code), CodePrefix, now, 3, ct);
        var receipt = GoodsReceipt.Create(code, request.SupplierId, request.ReceivedDate ?? VietnamDates.Today(timeProvider), request.Note, createdBy);
        await AddLinesAsync(receipt, request.Lines, ct);
        await receipts.AddAsync(receipt, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(receipt.Id, ct);
    }

    public async Task<GoodsReceiptDto> UpdateAsync(Guid id, SaveGoodsReceiptRequest request, CancellationToken ct = default)
    {
        var receipt = await LoadDraftAsync(id, ct);
        await EnsureSupplierAsync(request.SupplierId, ct);
        receipt.UpdateHeader(request.SupplierId, request.ReceivedDate ?? receipt.ReceivedDate, request.Note);
        receipt.ClearLines();
        await AddLinesAsync(receipt, request.Lines, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var receipt = await LoadDraftAsync(id, ct);
        receipts.Delete(receipt);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<ConfirmGoodsReceiptResult> ConfirmAsync(Guid id, CancellationToken ct = default)
    {
        var userId = _access.UserId;
        await transaction.RunAsync(async token =>
        {
            var receipt = await LoadDraftAsync(id, token);
            var lines = receipt.Lines.OrderBy(l => l.LineNo).ToList();
            var tracked = await products.QueryNoTracking().Where(p => lines.Select(l => l.ProductId).Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.TrackExpiry, token);

            // BR-24: hàng có HSD bắt buộc hạn sử dụng, sau ngày nhập.
            for (var i = 0; i < lines.Count; i++)
            {
                var line = lines[i];
                if (!tracked.GetValueOrDefault(line.ProductId))
                    continue;
                if (line.ExpiryDate is null)
                    throw PosErrors.Create(PosErrors.ThieuHanSuDung, PosErrors.MissingExpiryMessage, $"lines[{i}].expiryDate");
                if (line.ExpiryDate <= receipt.ReceivedDate)
                    throw PosErrors.Create(PosErrors.ThieuHanSuDung, PosErrors.ExpiryBeforeReceiveMessage, $"lines[{i}].expiryDate");
            }

            var now = Now;
            var ledger = new StockLedger(products, units, movements);
            await ledger.LoadAsync(lines.Select(l => l.ProductId), token);
            foreach (var line in lines)
            {
                var state = ledger.Get(line.ProductId);
                var before = state.AvgCost;
                var after = StockMath.NextAvgCost(state.Stock, state.AvgCost, line.BaseQty, line.BaseUnitCost);
                line.SetCosts(before, after);
                ledger.Move(line.ProductId, line.BaseQty, MovementType.NhapHang, receipt.Id, receipt.Code, now, after);
                ledger.MarkUnitUsed(line.UnitId);
            }

            receipt.Confirm(userId, now);
            await ledger.FlushAsync(token);
            await unitOfWork.SaveChangesAsync(token);
            return true;
        }, ct);

        var dto = await GetByIdAsync(id, ct);
        var productIds = dto.Lines.Select(l => l.ProductId).Distinct().ToList();
        var after = await products.QueryNoTracking().Include(p => p.Units).Where(p => productIds.Contains(p.Id)).ToListAsync(ct);
        var lowMargin = after
            .Select(p => (Product: p, Margin: StockMath.MarginPct(p.BaseUnit.Price, p.AvgCost)))
            .Where(x => StockMath.IsLowMargin(x.Margin))
            .OrderBy(x => x.Product.Code)
            .Select(x => new LowMarginItem
            {
                ProductId = x.Product.Id,
                Code = x.Product.Code,
                Name = x.Product.Name,
                BaseUnit = x.Product.BaseUnit.Name,
                Price = x.Product.BaseUnit.Price,
                AvgCost = x.Product.AvgCost,
                MarginPct = x.Margin ?? 0,
                Units = x.Product.Units.OrderBy(u => u.SortOrder)
                    .Select(u => new LowMarginUnit { UnitId = u.Id, Name = u.Name, Factor = u.Factor, Price = u.Price }).ToList()
            })
            .ToList();

        return new ConfirmGoodsReceiptResult { Receipt = dto, LowMarginProducts = lowMargin };
    }

    private async Task<GoodsReceipt> LoadDraftAsync(Guid id, CancellationToken ct)
    {
        var receipt = await receipts.Query().Include(r => r.Lines).FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy phiếu nhập");
        if (receipt.IsConfirmed)
            throw PosErrors.Create(PosErrors.PhieuDaNhapKho, PosErrors.ReceiptConfirmedMessage);
        return receipt;
    }

    private async Task EnsureSupplierAsync(Guid supplierId, CancellationToken ct)
    {
        if (!await suppliers.AnyAsync(s => s.Id == supplierId, ct))
            throw FieldErrors.Single("supplierId", "Nhà cung cấp không tồn tại");
    }

    private async Task AddLinesAsync(GoodsReceipt receipt, IReadOnlyList<GoodsReceiptLineInput> lines, CancellationToken ct)
    {
        var ids = lines.Select(l => l.ProductId).Distinct().ToList();
        var map = await products.QueryNoTracking().Include(p => p.Units).Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
        for (var i = 0; i < lines.Count; i++)
        {
            var input = lines[i];
            if (!map.TryGetValue(input.ProductId, out var product))
                throw FieldErrors.Single($"lines[{i}].productId", "Không tìm thấy mặt hàng");
            var unit = product.Units.FirstOrDefault(u => u.Id == input.UnitId)
                ?? throw PosErrors.Create(PosErrors.DonViKhongHopLe, PosErrors.InvalidUnitMessage, $"lines[{i}].unitId");
            receipt.AddLine(product.Id, unit.Id, unit.Name, unit.Factor, input.Quantity, input.UnitPrice, input.ExpiryDate);
        }
    }

    private static GoodsReceiptDto ToDto(GoodsReceipt receipt) => new()
    {
        Id = receipt.Id,
        Code = receipt.Code,
        SupplierId = receipt.SupplierId,
        SupplierName = receipt.Supplier?.Name ?? string.Empty,
        Status = receipt.Status,
        ReceivedDate = receipt.ReceivedDate,
        ConfirmedAt = receipt.ConfirmedAt,
        CreatedByName = receipt.CreatedByName,
        Note = receipt.Note,
        Lines = receipt.Lines.OrderBy(l => l.LineNo).Select(l => new GoodsReceiptLineDto
        {
            Id = l.Id,
            LineNo = l.LineNo,
            ProductId = l.ProductId,
            ProductCode = l.Product?.Code ?? string.Empty,
            ProductName = l.Product?.Name ?? string.Empty,
            UnitId = l.UnitId,
            UnitName = l.UnitName,
            Factor = l.Factor,
            Quantity = l.Quantity,
            BaseQty = l.BaseQty,
            UnitPrice = l.UnitPrice,
            Amount = l.Amount,
            BaseUnitCost = l.BaseUnitCost,
            TrackExpiry = l.Product?.TrackExpiry ?? false,
            ExpiryDate = l.ExpiryDate,
            CostBefore = l.CostBefore,
            CostAfter = l.CostAfter
        }).ToList(),
        TotalAmount = receipt.TotalAmount,
        CreatedAt = receipt.CreatedAt
    };
}
