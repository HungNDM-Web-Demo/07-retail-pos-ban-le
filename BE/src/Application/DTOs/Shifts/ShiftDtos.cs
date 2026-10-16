using Application.Common.Models;
using Application.DTOs.Orders;
using Application.DTOs.Returns;
using Domain.Enums.Pos.Approvals;
using Domain.Enums.Pos.Shifts;

namespace Application.DTOs.Shifts;

// Hợp đồng 07 §2.7.

public sealed record CashCountItem
{
    public int Denomination { get; init; }
    public int Count { get; init; }
}

public record ShiftDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public ShiftStatus Status { get; init; }
    public Guid CashierId { get; init; }
    public string CashierName { get; init; } = string.Empty;
    public DateTime OpenedAt { get; init; }
    public DateTime? ClosedAt { get; init; }
    public decimal OpeningCash { get; init; }
    public int OrderCount { get; init; }
    public int ReturnCount { get; init; }

    /// <summary>Khóa là tên phương thức: TienMat, ChuyenKhoan, The, BuTruDoiHang.</summary>
    public IReadOnlyDictionary<string, decimal> SalesByMethod { get; init; } = new Dictionary<string, decimal>();

    public decimal SalesTotal { get; init; }

    /// <summary>Khóa TienMat, ChuyenKhoan, BuTruDoiHang.</summary>
    public IReadOnlyDictionary<string, decimal> RefundByMethod { get; init; } = new Dictionary<string, decimal>();

    public decimal RefundTotal { get; init; }
    public decimal NetRevenue { get; init; }
    public decimal ExpectedCash { get; init; }
    public decimal? CountedCash { get; init; }
    public decimal? Difference { get; init; }
    public IReadOnlyList<CashCountItem>? CashCount { get; init; }
    public string? Note { get; init; }
    public string? ReviewNote { get; init; }
    public string? ReviewedByName { get; init; }
    public DateTime? ReviewedAt { get; init; }
}

public sealed record ShiftApprovalItem
{
    public ApprovalAction Action { get; init; }
    public Guid DocumentId { get; init; }
    public string DocumentCode { get; init; } = string.Empty;
    public string ApprovedByName { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public DateTime At { get; init; }
}

public sealed record ShiftDetail : ShiftDto
{
    public IReadOnlyList<OrderListItem> Orders { get; init; } = [];
    public IReadOnlyList<ReturnListItem> Returns { get; init; } = [];
    public IReadOnlyList<ShiftApprovalItem> Approvals { get; init; } = [];
}

public sealed record OpenShiftRequest
{
    public decimal? OpeningCash { get; init; }
}

public sealed record CloseShiftRequest
{
    public IReadOnlyList<CashCountItem> CashCount { get; init; } = [];
    public string? Note { get; init; }
}

public sealed record ReviewShiftRequest
{
    public string Note { get; init; } = string.Empty;
}

public sealed class ShiftQuery : PaginationQuery
{
    public string? From { get; set; }
    public string? To { get; set; }
    public Guid? CashierId { get; set; }
    public ShiftStatus? Status { get; set; }
}

/// <summary>Kết quả mở ca: <see cref="Created"/> = false khi đã có ca mở (trả 200 ca đó, UC-02 E2).</summary>
public sealed record OpenShiftResult(ShiftDto Shift, bool Created);
