using Application.Common.Models;
using Domain.Entities.Pos;
using Domain.Enums.Pos.Approvals;
using Domain.Enums.Pos.Orders;

namespace Application.DTOs.Orders;

// Hợp đồng 07 §2.4, §2.5.

public sealed record DiscountInput
{
    public DiscountType Type { get; init; }

    /// <summary>Phần trăm 0–100 (tối đa 1 chữ số thập phân) hoặc số tiền bội số 500.</summary>
    public decimal Value { get; init; }

    public DiscountReason Reason { get; init; }
    public string? Note { get; init; }
}

public sealed record CartLineInput
{
    public Guid ProductId { get; init; }
    public Guid UnitId { get; init; }
    public int Quantity { get; init; }
    public DiscountInput? Discount { get; init; }
}

public record CartInput
{
    public IReadOnlyList<CartLineInput> Lines { get; init; } = [];
    public DiscountInput? OrderDiscount { get; init; }
    public Guid? CustomerId { get; init; }
}

public sealed record QuoteLine
{
    public Guid ProductId { get; init; }
    public Guid UnitId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public string UnitName { get; init; } = string.Empty;
    public int Factor { get; init; }
    public int Quantity { get; init; }
    public int BaseQty { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal Amount { get; init; }
    public decimal DiscountAmount { get; init; }
    public decimal AllocatedDiscount { get; init; }
    public decimal NetAmount { get; init; }
}

/// <summary>Dòng vượt tồn (BR-10).</summary>
public sealed record OverStockLine
{
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public int Shortage { get; init; }
    public string BaseUnit { get; init; } = string.Empty;
}

public sealed record OrderQuote
{
    public IReadOnlyList<QuoteLine> Lines { get; init; } = [];
    public decimal Subtotal { get; init; }
    public decimal LineDiscountTotal { get; init; }
    public decimal OrderDiscountAmount { get; init; }
    public decimal DiscountTotal { get; init; }
    public decimal DiscountPct { get; init; }
    public decimal Total { get; init; }
    public bool NeedsApproval { get; init; }
    public IReadOnlyList<ApprovalReason> ApprovalReasons { get; init; } = [];
    public IReadOnlyList<OverStockLine> OverStock { get; init; } = [];
    public int PointsToEarn { get; init; }
}

public sealed record TenderInput
{
    public TenderMethod Method { get; init; }

    /// <summary>Bắt buộc khi tiền mặt, ≥ số phải thu (BR-12).</summary>
    public decimal? CashReceived { get; init; }

    public string? Reference { get; init; }
}

public sealed record CheckoutRequest : CartInput
{
    public string ClientRequestId { get; init; } = string.Empty;
    public TenderInput Payment { get; init; } = new();
    public string? ApprovalToken { get; init; }
    public decimal ExpectedTotal { get; init; }
    public string? QrContent { get; init; }
}

public sealed record DiscountDto
{
    public DiscountType Type { get; init; }
    public decimal Value { get; init; }
    public decimal Amount { get; init; }
    public DiscountReason Reason { get; init; }
    public string? Note { get; init; }
}

public sealed record PaymentDto
{
    public PaymentMethod Method { get; init; }
    public decimal Amount { get; init; }
    public decimal? CashReceived { get; init; }
    public decimal? ChangeAmount { get; init; }
    public string? Reference { get; init; }
}

public sealed record OrderLineDto
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
    public DiscountDto? Discount { get; init; }
    public decimal AllocatedDiscount { get; init; }
    public decimal NetAmount { get; init; }
    public decimal? UnitCost { get; init; }
    public decimal? CostAmount { get; init; }
    public bool Returnable { get; init; }
    public int ReturnedQty { get; init; }
    public decimal RefundedAmount { get; init; }
}

public sealed record CustomerRef
{
    public Guid Id { get; init; }
    public string Phone { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
}

public sealed record DocumentRef
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
}

public sealed record OrderReturnRef
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public decimal RefundTotal { get; init; }
}

public sealed record OrderDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public DateTime PaidAt { get; init; }
    public Guid ShiftId { get; init; }
    public string ShiftCode { get; init; } = string.Empty;
    public Guid CashierId { get; init; }
    public string CashierName { get; init; } = string.Empty;
    public IReadOnlyList<OrderLineDto> Lines { get; init; } = [];
    public decimal Subtotal { get; init; }
    public decimal LineDiscountTotal { get; init; }
    public DiscountDto? OrderDiscount { get; init; }
    public decimal DiscountTotal { get; init; }
    public decimal Total { get; init; }
    public decimal? CostTotal { get; init; }
    public IReadOnlyList<PaymentDto> Payments { get; init; } = [];
    public string? ApprovedByName { get; init; }
    public CustomerRef? Customer { get; init; }
    public int PointsEarned { get; init; }
    public OrderReturnStatus ReturnStatus { get; init; }
    public string? Note { get; init; }
    public DocumentRef? ExchangeForReturn { get; init; }
    public IReadOnlyList<OrderReturnRef> Returns { get; init; } = [];
    public string? QrContent { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed record OrderListItem
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public DateTime PaidAt { get; init; }
    public string ShiftCode { get; init; } = string.Empty;
    public string CashierName { get; init; } = string.Empty;
    public int ItemCount { get; init; }
    public decimal Subtotal { get; init; }
    public decimal DiscountTotal { get; init; }
    public decimal Total { get; init; }
    public IReadOnlyList<PaymentMethod> PaymentMethods { get; init; } = [];
    public OrderReturnStatus ReturnStatus { get; init; }
    public bool IsExchange { get; init; }
    public string? CustomerName { get; init; }
    public string? ApprovedByName { get; init; }
    public string? Note { get; init; }
}

public sealed class OrderQuery : PaginationQuery
{
    public string? From { get; set; }
    public string? To { get; set; }
    public Guid? CashierId { get; set; }
    public Guid? ShiftId { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
    public OrderReturnStatus? ReturnStatus { get; set; }
    public Guid? CustomerId { get; set; }
}

public sealed record NextCodeDto
{
    public string Code { get; init; } = string.Empty;
}

/// <summary>Kết quả thanh toán: <see cref="Created"/> = false khi trùng clientRequestId (trả 200 hóa đơn cũ).</summary>
public sealed record CheckoutResult(OrderDto Order, bool Created);

// Xác nhận của chủ cửa hàng (07 §2.5).

public sealed record ApprovalRequest
{
    public string Username { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
    public ApprovalAction Action { get; init; }
}

public sealed record ApprovalDto
{
    public string Token { get; init; } = string.Empty;
    public ApprovalAction Action { get; init; }
    public Guid ApprovedById { get; init; }
    public string ApprovedByName { get; init; } = string.Empty;
    public DateTime ExpiresAt { get; init; }
}
