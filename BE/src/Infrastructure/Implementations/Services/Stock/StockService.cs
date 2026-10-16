using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Common.Time;
using Application.DTOs.Stock;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Stock;
using Domain.Common;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Pos;
using Domain.Enums.Inventory.Products;
using Domain.Enums.Inventory.Stock;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Stock;

/// <summary>Tồn kho, giá trị tồn, lô, sổ biến động (FR-30..FR-32, BR-02, BR-26, BR-27, 07 §2.8).</summary>
public sealed class StockService(
    IGenericRepository<Product> products,
    IGenericRepository<GoodsReceiptLine> receiptLines,
    IGenericRepository<StockMovement> movements,
    TimeProvider timeProvider) : IStockService
{
    public async Task<PaginatedResult<StockItem>> GetPagedAsync(StockQuery query, CancellationToken ct = default)
    {
        var items = await LoadItemsAsync(query.GroupId, query.Status, query.IncludeInactive ?? false, query.GetSearchTerm(), ct);
        var desc = !string.IsNullOrWhiteSpace(query.SortDir) && query.IsDescending();
        Func<StockItem, object> key = (query.SortBy ?? "code").Trim().ToLowerInvariant() switch
        {
            "name" => i => i.Name,
            "groupname" => i => i.GroupName,
            "stock" => i => i.Stock,
            "avgcost" => i => i.AvgCost,
            "stockvalue" => i => i.StockValue,
            "minstock" => i => i.MinStock,
            "status" => i => i.Status,
            _ => i => i.Code
        };
        var sorted = (desc ? items.OrderByDescending(key) : items.OrderBy(key)).ThenBy(i => i.Code).ToList();
        var page = query.GetPage();
        var size = query.GetPageSize();
        return new PaginatedResult<StockItem>
        {
            Items = sorted.Skip((page - 1) * size).Take(size).ToList(),
            Page = page,
            PageSize = size,
            TotalCount = sorted.Count
        };
    }

    public async Task<StockSummary> GetSummaryAsync(StockSummaryQuery query, CancellationToken ct = default)
    {
        var includeInactive = query.IncludeInactive ?? false;
        var items = await LoadItemsAsync(query.GroupId, query.Status, includeInactive, null, ct);
        var active = (await LoadItemsAsync(query.GroupId, null, false, null, ct)).ToList();
        var lots = await LotCalculator.AllLotsAsync(products, receiptLines, VietnamDates.Today(timeProvider), null, ct);
        if (query.GroupId is { } groupId)
        {
            var inGroup = active.Select(a => a.ProductId).ToHashSet();
            lots = lots.Where(l => inGroup.Contains(l.ProductId)).ToList();
        }

        return new StockSummary
        {
            TotalValue = items.Sum(i => i.StockValue),
            ProductCount = items.Count,
            ByStatus = Enum.GetValues<StockStatus>().ToDictionary(s => s.ToString(), s => active.Count(a => a.Status == s)),
            ExpiringLotCount = lots.Count(l => l.Status == LotStatus.SapHetHan),
            ExpiredLotCount = lots.Count(l => l.Status == LotStatus.DaHetHan)
        };
    }

    public async Task<IReadOnlyList<StockLotDto>> GetLotsAsync(StockLotQuery query, CancellationToken ct = default)
    {
        var lots = await LotCalculator.AllLotsAsync(products, receiptLines, VietnamDates.Today(timeProvider), query.ProductId, ct);
        // Mặc định: lô sắp hết hạn, đã hết hạn; lọc theo mặt hàng mà không lọc trạng thái thì mọi lô còn hàng.
        var filtered = query.Status is { } status
            ? lots.Where(l => l.Status == status && (status != LotStatus.ConHan || l.RemainingQty > 0))
            : query.ProductId is not null
                ? lots.Where(l => l.RemainingQty > 0)
                : lots.Where(l => l.Status is LotStatus.SapHetHan or LotStatus.DaHetHan);
        return filtered.OrderBy(l => l.ExpiryDate).ThenBy(l => l.ProductCode).ToList();
    }

    public async Task<PaginatedResult<StockMovementDto>> GetMovementsAsync(Guid productId, PaginationQuery query, CancellationToken ct = default)
    {
        if (!await products.QueryNoTracking().IgnoreQueryFilters().AnyAsync(p => p.Id == productId, ct))
            throw new NotFoundException("Không tìm thấy mặt hàng");

        var page = await movements.QueryNoTracking()
            .Where(m => m.ProductId == productId)
            .OrderByDescending(m => m.OccurredAt).ThenByDescending(m => m.Seq)
            .ToPaginatedResultAsync(query, ct);
        return page.Map(items => items.Select(m => new StockMovementDto
        {
            Id = m.Id,
            At = m.OccurredAt,
            Type = m.Type,
            DocumentId = m.DocumentId,
            DocumentCode = m.DocumentCode,
            Quantity = m.Quantity,
            StockAfter = m.StockAfter,
            CostAfter = m.CostAfter
        }).ToList());
    }

    private async Task<List<StockItem>> LoadItemsAsync(Guid? groupId, StockStatus? status, bool includeInactive, string? search, CancellationToken ct)
    {
        var source = products.QueryNoTracking().Include(p => p.Group).Include(p => p.Units).AsSplitQuery();
        if (!includeInactive)
            source = source.Where(p => p.Status == ProductStatus.DangBan);
        if (groupId is { } g)
            source = source.Where(p => p.GroupId == g);
        if (search is not null)
        {
            var pattern = LikePattern.Contains(VietnameseText.Normalize(search));
            var raw = search.Trim();
            source = source.Where(p => AppDbFunctions.Matches(p.NameSearch, pattern) || p.Code == raw || p.Units.Any(u => u.Barcode == raw));
        }

        var list = await source.ToListAsync(ct);
        return list
            .Where(p => status is null || p.StockStatus == status)
            .Select(p => new StockItem
            {
                ProductId = p.Id,
                Code = p.Code,
                Name = p.Name,
                GroupId = p.GroupId,
                GroupName = p.Group?.Name ?? string.Empty,
                BaseUnit = p.BaseUnit.Name,
                Stock = p.Stock,
                StockText = StockMath.StockText(p.Stock, p.UnitFactors()),
                AvgCost = p.AvgCost,
                StockValue = p.Stock * p.AvgCost,
                MinStock = p.MinStock,
                Status = p.StockStatus,
                ProductStatus = p.Status,
                TrackExpiry = p.TrackExpiry
            })
            .ToList();
    }
}
