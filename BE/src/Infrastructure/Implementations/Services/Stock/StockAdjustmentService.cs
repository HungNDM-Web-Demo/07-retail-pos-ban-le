using Application.Common.Exceptions;
using Application.Common.Models;
using Application.DTOs.Stock;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Roles;
using Application.Interfaces.Services.Stock;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.StockAdjustments;
using Domain.Entities.System.Users;
using Domain.Enums.Inventory.Stock;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Common;
using Infrastructure.Implementations.Services.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Stock;

/// <summary>
/// Phiếu điều chỉnh tồn (UC-13, BR-28): lưu là áp dụng ngay; chênh lệch = thực tế − hệ thống; không đổi giá vốn.
/// Dòng chênh 0 bỏ qua.
/// </summary>
public sealed class StockAdjustmentService(
    IGenericRepository<StockAdjustment> adjustments,
    IGenericRepository<Product> products,
    IGenericRepository<ProductUnit> units,
    IGenericRepository<StockMovement> movements,
    IGenericRepository<GoodsReceiptLine> receiptLines,
    IGenericRepository<User> users,
    IUnitOfWork unitOfWork,
    IPosTransaction transaction,
    ICurrentUserService currentUser,
    IPermissionService permissionService,
    TimeProvider timeProvider) : IStockAdjustmentService
{
    public const string CodePrefix = "DC";
    public const string NoDifferenceMessage = "Không có chênh lệch để điều chỉnh";

    private readonly PosAccess _access = new(currentUser, permissionService);

    public async Task<PaginatedResult<StockAdjustmentListItem>> GetPagedAsync(StockAdjustmentQuery query, CancellationToken ct = default)
    {
        var source = adjustments.QueryNoTracking().Include(a => a.Lines).AsQueryable();
        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(a => AppDbFunctions.Matches(a.Code, pattern) || AppDbFunctions.Matches(a.Note, pattern));
        }

        var (from, to) = PosQueries.UtcRange(query.From, query.To);
        if (from is { } f)
            source = source.Where(a => a.CreatedAt >= f);
        if (to is { } t)
            source = source.Where(a => a.CreatedAt < t);
        if (query.Reason is { } reason)
            source = source.Where(a => a.Reason == reason);

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        return page.Map(items => items.Select(a => new StockAdjustmentListItem
        {
            Id = a.Id,
            Code = a.Code,
            CreatedAt = a.CreatedAt,
            CreatedByName = a.CreatedByName,
            Reason = a.Reason,
            Note = a.Note,
            LineCount = a.Lines.Count,
            TotalValue = a.TotalValue
        }).ToList());
    }

    public async Task<StockAdjustmentDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var adjustment = await adjustments.QueryNoTracking()
            .Include(a => a.Lines).ThenInclude(l => l.Product).ThenInclude(p => p!.Units)
            .AsSplitQuery()
            .FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy phiếu điều chỉnh");
        return ToDto(adjustment);
    }

    public async Task<StockAdjustmentDto> CreateAsync(CreateStockAdjustmentRequest request, CancellationToken ct = default)
    {
        if (request.GoodsReceiptLineId is { } lotId && !await receiptLines.AnyAsync(l => l.Id == lotId, ct))
            throw FieldErrors.Single("goodsReceiptLineId", "Không tìm thấy lô");

        var createdBy = await _access.FullNameAsync(users, ct);
        var id = await transaction.RunAsync(async token =>
        {
            var ids = request.Lines.Select(l => l.ProductId).ToList();
            var existing = await products.QueryNoTracking().Where(p => ids.Contains(p.Id)).Select(p => p.Id).ToListAsync(token);
            for (var i = 0; i < request.Lines.Count; i++)
            {
                if (!existing.Contains(request.Lines[i].ProductId))
                    throw FieldErrors.Single($"lines[{i}].productId", "Không tìm thấy mặt hàng");
            }

            var ledger = new StockLedger(products, units, movements);
            await ledger.LoadAsync(ids, token);
            var changes = request.Lines.Where(l => ledger.Get(l.ProductId).Stock != l.ActualQty).ToList();
            if (changes.Count == 0)
                throw FieldErrors.Single("lines", NoDifferenceMessage);

            var now = timeProvider.GetUtcNow().UtcDateTime;
            var code = await DocCodes.NextAsync(adjustments.QueryNoTracking().Select(a => a.Code), CodePrefix, now, 3, token);
            var adjustment = StockAdjustment.Create(code, request.Reason, request.Note, request.GoodsReceiptLineId, createdBy, now);
            foreach (var line in changes)
            {
                var state = ledger.Get(line.ProductId);
                var adjustmentLine = adjustment.AddLine(line.ProductId, state.Stock, line.ActualQty, state.AvgCost);
                ledger.Move(line.ProductId, adjustmentLine.Difference, MovementType.DieuChinh, adjustment.Id, adjustment.Code, now);
            }

            await ledger.FlushAsync(token);
            await adjustments.AddAsync(adjustment, token);
            await unitOfWork.SaveChangesAsync(token);
            return adjustment.Id;
        }, ct);

        return await GetByIdAsync(id, ct);
    }

    private static StockAdjustmentDto ToDto(StockAdjustment adjustment) => new()
    {
        Id = adjustment.Id,
        Code = adjustment.Code,
        CreatedAt = adjustment.CreatedAt,
        CreatedByName = adjustment.CreatedByName,
        Reason = adjustment.Reason,
        Note = adjustment.Note,
        GoodsReceiptLineId = adjustment.GoodsReceiptLineId,
        Lines = adjustment.Lines.Select(l => new StockAdjustmentLineDto
        {
            ProductId = l.ProductId,
            ProductCode = l.Product?.Code ?? string.Empty,
            ProductName = l.Product?.Name ?? string.Empty,
            BaseUnit = l.Product?.Units.FirstOrDefault(u => u.IsBase)?.Name ?? string.Empty,
            SystemQty = l.SystemQty,
            ActualQty = l.ActualQty,
            Difference = l.Difference,
            UnitCost = l.UnitCost,
            Value = l.Value
        }).OrderBy(l => l.ProductCode).ToList(),
        TotalValue = adjustment.TotalValue
    };
}
