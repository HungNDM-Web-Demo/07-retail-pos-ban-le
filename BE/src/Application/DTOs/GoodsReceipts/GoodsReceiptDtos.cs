using Application.Common.Models;
using Domain.Enums.Inventory.GoodsReceipts;

namespace Application.DTOs.GoodsReceipts;

// Hợp đồng 07 §2.9.

public sealed record SupplierDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Phone { get; init; }
    public string? Address { get; init; }
    public string? Note { get; init; }
    public int ReceiptCount { get; init; }
    public decimal TotalPurchased { get; init; }
    public DateTime? LastReceiptAt { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed record SaveSupplierRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Phone { get; init; }
    public string? Address { get; init; }
    public string? Note { get; init; }
}

public sealed record GoodsReceiptLineInput
{
    public Guid ProductId { get; init; }
    public Guid UnitId { get; init; }
    public int Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public DateOnly? ExpiryDate { get; init; }
}

public sealed record SaveGoodsReceiptRequest
{
    public Guid SupplierId { get; init; }
    public DateOnly? ReceivedDate { get; init; }
    public string? Note { get; init; }
    public IReadOnlyList<GoodsReceiptLineInput> Lines { get; init; } = [];
}

public sealed record GoodsReceiptLineDto
{
    public Guid Id { get; init; }
    public int LineNo { get; init; }
    public Guid ProductId { get; init; }
    public string ProductCode { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public Guid UnitId { get; init; }
    public string UnitName { get; init; } = string.Empty;
    public int Factor { get; init; }
    public int Quantity { get; init; }
    public int BaseQty { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal Amount { get; init; }
    public decimal BaseUnitCost { get; init; }
    public bool TrackExpiry { get; init; }
    public DateOnly? ExpiryDate { get; init; }
    public decimal? CostBefore { get; init; }
    public decimal? CostAfter { get; init; }
}

public sealed record GoodsReceiptDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public Guid SupplierId { get; init; }
    public string SupplierName { get; init; } = string.Empty;
    public GoodsReceiptStatus Status { get; init; }
    public DateOnly ReceivedDate { get; init; }
    public DateTime? ConfirmedAt { get; init; }
    public string CreatedByName { get; init; } = string.Empty;
    public string? Note { get; init; }
    public IReadOnlyList<GoodsReceiptLineDto> Lines { get; init; } = [];
    public decimal TotalAmount { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed record GoodsReceiptListItem
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public Guid SupplierId { get; init; }
    public string SupplierName { get; init; } = string.Empty;
    public GoodsReceiptStatus Status { get; init; }
    public DateOnly ReceivedDate { get; init; }
    public DateTime? ConfirmedAt { get; init; }
    public int LineCount { get; init; }
    public decimal TotalAmount { get; init; }
}

public sealed class GoodsReceiptQuery : PaginationQuery
{
    public GoodsReceiptStatus? Status { get; set; }
    public Guid? SupplierId { get; set; }
    public string? From { get; set; }
    public string? To { get; set; }
}

public sealed record LowMarginUnit
{
    public Guid UnitId { get; init; }
    public string Name { get; init; } = string.Empty;
    public int Factor { get; init; }
    public decimal Price { get; init; }
}

public sealed record LowMarginItem
{
    public Guid ProductId { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public decimal AvgCost { get; init; }
    public decimal MarginPct { get; init; }
    public IReadOnlyList<LowMarginUnit> Units { get; init; } = [];
}

public sealed record ConfirmGoodsReceiptResult
{
    public GoodsReceiptDto Receipt { get; init; } = new();
    public IReadOnlyList<LowMarginItem> LowMarginProducts { get; init; } = [];
}
