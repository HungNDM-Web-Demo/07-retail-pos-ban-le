using Application.Common.Models;
using Application.DTOs.Stock;

namespace Application.Interfaces.Services.Stock;

/// <summary>Tồn kho, lô, sổ biến động (FR-30..FR-32, 07 §2.8).</summary>
public interface IStockService
{
    Task<PaginatedResult<StockItem>> GetPagedAsync(StockQuery query, CancellationToken ct = default);

    Task<StockSummary> GetSummaryAsync(StockSummaryQuery query, CancellationToken ct = default);

    Task<IReadOnlyList<StockLotDto>> GetLotsAsync(StockLotQuery query, CancellationToken ct = default);

    Task<PaginatedResult<StockMovementDto>> GetMovementsAsync(Guid productId, PaginationQuery query, CancellationToken ct = default);
}

/// <summary>Phiếu điều chỉnh tồn (UC-13, BR-28).</summary>
public interface IStockAdjustmentService
{
    Task<PaginatedResult<StockAdjustmentListItem>> GetPagedAsync(StockAdjustmentQuery query, CancellationToken ct = default);

    Task<StockAdjustmentDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<StockAdjustmentDto> CreateAsync(CreateStockAdjustmentRequest request, CancellationToken ct = default);
}
