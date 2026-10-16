using Application.Common.Models;
using Application.DTOs.Orders;
using Domain.Enums.Pos.Returns;

namespace Application.DTOs.Returns;

// Hợp đồng 07 §2.6.

public sealed record ReturnSourceLine
{
    public Guid OrderLineId { get; init; }
    public int LineNo { get; init; }
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public Guid UnitId { get; init; }
    public string UnitName { get; init; } = string.Empty;
    public int Factor { get; init; }
    public int Quantity { get; init; }
    public int ReturnedQty { get; init; }
    public int ReturnableQty { get; init; }
    public decimal NetAmount { get; init; }
    public decimal RefundedAmount { get; init; }
    public decimal UnitNetPrice { get; init; }
    public bool Returnable { get; init; }
}

public sealed record ReturnSourceOrder
{
    public Guid OrderId { get; init; }
    public string Code { get; init; } = string.Empty;
    public DateTime PaidAt { get; init; }
    public int DaysSince { get; init; }
    public string CashierName { get; init; } = string.Empty;
    public decimal Total { get; init; }
    public IReadOnlyList<PaymentDto> Payments { get; init; } = [];
    public CustomerRef? Customer { get; init; }
    public IReadOnlyList<ReturnSourceLine> Lines { get; init; } = [];
    public bool NeedsApproval { get; init; }
    public string? ApprovalText { get; init; }
}

public sealed record ReturnSourceListItem
{
    public Guid OrderId { get; init; }
    public string Code { get; init; } = string.Empty;
    public DateTime PaidAt { get; init; }
    public decimal Total { get; init; }
    public int ItemCount { get; init; }
    public string CashierName { get; init; } = string.Empty;
}

public sealed class ReturnSourceQuery : PaginationQuery
{
    public string? Date { get; set; }
    public Guid? ProductId { get; set; }
}

public sealed record ReturnLineInput
{
    public Guid OrderLineId { get; init; }
    public int Quantity { get; init; }
    public ReturnCondition Condition { get; init; }
    public ReturnReason Reason { get; init; }
    public string? Note { get; init; }
}

public sealed record ExchangeLineInput
{
    public Guid ProductId { get; init; }
    public Guid UnitId { get; init; }
    public int Quantity { get; init; }
}

public sealed record ExchangeInput
{
    public IReadOnlyList<ExchangeLineInput> Lines { get; init; } = [];
    public decimal ExpectedTotal { get; init; }

    /// <summary>Bắt buộc khi chênh lệch dương (khách trả thêm).</summary>
    public TenderInput? Payment { get; init; }

    public string? QrContent { get; init; }
}

public sealed record CreateReturnRequest
{
    public string ClientRequestId { get; init; } = string.Empty;
    public Guid OrderId { get; init; }
    public IReadOnlyList<ReturnLineInput> Lines { get; init; } = [];
    public RefundMethod RefundMethod { get; init; }
    public string? Note { get; init; }
    public string? ApprovalToken { get; init; }
    public decimal ExpectedRefundTotal { get; init; }
    public ExchangeInput? Exchange { get; init; }
}

public sealed record ReturnLineDto
{
    public Guid Id { get; init; }
    public Guid OrderLineId { get; init; }
    public Guid ProductId { get; init; }
    public string ProductCode { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string UnitName { get; init; } = string.Empty;
    public int Factor { get; init; }
    public int Quantity { get; init; }
    public int BaseQty { get; init; }
    public ReturnCondition Condition { get; init; }
    public ReturnReason Reason { get; init; }
    public string? Note { get; init; }
    public decimal RefundAmount { get; init; }
    public decimal? UnitCost { get; init; }
    public decimal? CostAmount { get; init; }
}

public sealed record ExchangeOrderRef
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public decimal Total { get; init; }
}

public sealed record ReturnDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public Guid ShiftId { get; init; }
    public string ShiftCode { get; init; } = string.Empty;
    public Guid CashierId { get; init; }
    public string CashierName { get; init; } = string.Empty;
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public DateTime OrderPaidAt { get; init; }
    public IReadOnlyList<ReturnLineDto> Lines { get; init; } = [];
    public decimal RefundTotal { get; init; }
    public decimal OffsetAmount { get; init; }
    public decimal PayoutAmount { get; init; }
    public RefundMethod RefundMethod { get; init; }
    public ExchangeOrderRef? ExchangeOrder { get; init; }

    /// <summary>Tổng hóa đơn đổi − tiền hoàn (BR-20); dương: khách trả thêm.</summary>
    public decimal Difference { get; init; }

    public string? ApprovedByName { get; init; }
    public string? Note { get; init; }
    public int PointsDeducted { get; init; }
}

public sealed record ReturnListItem
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public string CashierName { get; init; } = string.Empty;
    public string OrderCode { get; init; } = string.Empty;
    public decimal RefundTotal { get; init; }
    public decimal PayoutAmount { get; init; }
    public RefundMethod RefundMethod { get; init; }
    public string? ExchangeOrderCode { get; init; }
    public decimal Difference { get; init; }
    public bool HasDefective { get; init; }
    public string? ApprovedByName { get; init; }
}

public sealed class ReturnQuery : PaginationQuery
{
    public string? From { get; set; }
    public string? To { get; set; }
    public Guid? CashierId { get; set; }
    public Guid? ShiftId { get; set; }
}

/// <summary>Kết quả lập phiếu: <see cref="Created"/> = false khi trùng clientRequestId.</summary>
public sealed record CreateReturnResult(ReturnDto Return, bool Created);
