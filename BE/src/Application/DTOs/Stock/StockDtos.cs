using Application.Common.Models;
using Domain.Enums.Inventory.Products;
using Domain.Enums.Inventory.Stock;
using Domain.Enums.Inventory.StockAdjustments;

namespace Application.DTOs.Stock;

// Hợp đồng 07 §2.8.

public sealed record StockItem
{
    public Guid ProductId { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public Guid GroupId { get; init; }
    public string GroupName { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public int Stock { get; init; }
    public string StockText { get; init; } = string.Empty;
    public decimal AvgCost { get; init; }
    public decimal StockValue { get; init; }
    public int MinStock { get; init; }
    public StockStatus Status { get; init; }
    public ProductStatus ProductStatus { get; init; }
    public bool TrackExpiry { get; init; }
}

public sealed class StockQuery : PaginationQuery
{
    public Guid? GroupId { get; set; }
    public StockStatus? Status { get; set; }

    /// <summary>Mặc định false: bỏ hàng ngừng bán.</summary>
    public bool? IncludeInactive { get; set; }
}

public sealed class StockSummaryQuery
{
    public Guid? GroupId { get; set; }
    public StockStatus? Status { get; set; }
    public bool? IncludeInactive { get; set; }
}

public sealed record StockSummary
{
    public decimal TotalValue { get; init; }
    public int ProductCount { get; init; }

    /// <summary>Khóa AmKho, HetHang, SapHet, ConHang (hàng đang bán).</summary>
    public IReadOnlyDictionary<string, int> ByStatus { get; init; } = new Dictionary<string, int>();

    public int ExpiringLotCount { get; init; }
    public int ExpiredLotCount { get; init; }
}

public sealed record StockLotDto
{
    public Guid GoodsReceiptLineId { get; init; }
    public Guid GoodsReceiptId { get; init; }
    public string GoodsReceiptCode { get; init; } = string.Empty;
    public Guid ProductId { get; init; }
    public string ProductCode { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public DateTime ReceivedAt { get; init; }
    public DateOnly ExpiryDate { get; init; }
    public int DaysLeft { get; init; }
    public int ReceivedQty { get; init; }
    public int RemainingQty { get; init; }
    public LotStatus Status { get; init; }
}

public sealed class StockLotQuery
{
    public LotStatus? Status { get; set; }
    public Guid? ProductId { get; set; }
}

public sealed record StockMovementDto
{
    public Guid Id { get; init; }
    public DateTime At { get; init; }
    public MovementType Type { get; init; }
    public Guid? DocumentId { get; init; }
    public string DocumentCode { get; init; } = string.Empty;
    public int Quantity { get; init; }
    public int StockAfter { get; init; }
    public decimal CostAfter { get; init; }
}

public sealed record StockAdjustmentLineInput
{
    public Guid ProductId { get; init; }
    public int ActualQty { get; init; }
}

public sealed record CreateStockAdjustmentRequest
{
    public AdjustmentReason Reason { get; init; }
    public string? Note { get; init; }
    public IReadOnlyList<StockAdjustmentLineInput> Lines { get; init; } = [];
    public Guid? GoodsReceiptLineId { get; init; }
}

public sealed record StockAdjustmentLineDto
{
    public Guid ProductId { get; init; }
    public string ProductCode { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public int SystemQty { get; init; }
    public int ActualQty { get; init; }
    public int Difference { get; init; }
    public decimal UnitCost { get; init; }
    public decimal Value { get; init; }
}

public sealed record StockAdjustmentDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public string CreatedByName { get; init; } = string.Empty;
    public AdjustmentReason Reason { get; init; }
    public string? Note { get; init; }
    public Guid? GoodsReceiptLineId { get; init; }
    public IReadOnlyList<StockAdjustmentLineDto> Lines { get; init; } = [];
    public decimal TotalValue { get; init; }
}

public sealed record StockAdjustmentListItem
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public string CreatedByName { get; init; } = string.Empty;
    public AdjustmentReason Reason { get; init; }
    public string? Note { get; init; }
    public int LineCount { get; init; }
    public decimal TotalValue { get; init; }
}

public sealed class StockAdjustmentQuery : PaginationQuery
{
    public string? From { get; set; }
    public string? To { get; set; }
    public AdjustmentReason? Reason { get; set; }
}
