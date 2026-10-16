using Domain.Enums.Inventory.StockAdjustments;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Returns;

namespace Application.DTOs.Reports;

// Hợp đồng 07 §2.10, công thức 07 §3.9.

public class DateRangeQuery
{
    /// <summary>yyyy-MM-dd giờ Việt Nam.</summary>
    public string? From { get; set; }

    public string? To { get; set; }
}

public sealed class ProductProfitQuery : DateRangeQuery
{
    public Guid? GroupId { get; set; }

    /// <summary>quantity | netRevenue | grossProfit (mặc định).</summary>
    public string? SortBy { get; set; }

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

public sealed class ReturnsReportQuery : DateRangeQuery
{
    public ReturnReason? Reason { get; set; }
}

public sealed record KpiSet
{
    public decimal NetRevenue { get; init; }
    public decimal GrossProfit { get; init; }
    public int OrderCount { get; init; }
    public decimal AvgOrderValue { get; init; }
}

public sealed record DashboardDay
{
    public string Date { get; init; } = string.Empty;
    public decimal NetRevenue { get; init; }
    public decimal GrossProfit { get; init; }
}

public sealed record DashboardTopProduct
{
    public Guid ProductId { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public int Quantity { get; init; }
    public decimal NetRevenue { get; init; }
}

public sealed record DashboardDto
{
    public DateTime AsOf { get; init; }
    public KpiSet Today { get; init; } = new();
    public KpiSet SameTimeYesterday { get; init; } = new();
    public IReadOnlyList<DashboardDay> Last7Days { get; init; } = [];
    public IReadOnlyList<DashboardTopProduct> TopProducts { get; init; } = [];
    public int LowStockCount { get; init; }
    public int ExpiringLotCount { get; init; }
    public int ExpiredLotCount { get; init; }
}

public record RevenueTotals
{
    public decimal SalesTotal { get; init; }
    public decimal RefundTotal { get; init; }
    public decimal NetRevenue { get; init; }
    public decimal Cogs { get; init; }
    public decimal GrossProfit { get; init; }
    public decimal MarginPct { get; init; }
    public int OrderCount { get; init; }
    public int ReturnCount { get; init; }
}

public sealed record RevenueDay : RevenueTotals
{
    public string Date { get; init; } = string.Empty;
}

public sealed record RevenuePrevious
{
    public string From { get; init; } = string.Empty;
    public string To { get; init; } = string.Empty;
    public RevenueTotals Totals { get; init; } = new();
    public IReadOnlyList<DashboardDay> Days { get; init; } = [];
}

public sealed record RevenueReport
{
    public string From { get; init; } = string.Empty;
    public string To { get; init; } = string.Empty;
    public IReadOnlyList<RevenueDay> Days { get; init; } = [];
    public RevenueTotals Totals { get; init; } = new();
    public RevenuePrevious Previous { get; init; } = new();
}

public sealed record GroupProfitRow
{
    public Guid GroupId { get; init; }
    public string GroupName { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public decimal NetRevenue { get; init; }
    public decimal Cogs { get; init; }
    public decimal GrossProfit { get; init; }
    public decimal MarginPct { get; init; }
    public decimal ProfitShare { get; init; }
}

public sealed record ProfitTotals
{
    public decimal NetRevenue { get; init; }
    public decimal Cogs { get; init; }
    public decimal GrossProfit { get; init; }
    public decimal MarginPct { get; init; }
}

public sealed record GroupProfitReport
{
    public string From { get; init; } = string.Empty;
    public string To { get; init; } = string.Empty;
    public IReadOnlyList<GroupProfitRow> Rows { get; init; } = [];
    public ProfitTotals Totals { get; init; } = new();
}

public sealed record ProductProfitRow
{
    public int Rank { get; init; }
    public Guid ProductId { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string GroupName { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public int Quantity { get; init; }
    public decimal NetRevenue { get; init; }
    public decimal Cogs { get; init; }
    public decimal GrossProfit { get; init; }
    public decimal MarginPct { get; init; }
}

public sealed record ReturnReasonRow
{
    public ReturnReason Reason { get; init; }
    public int Count { get; init; }
    public decimal RefundTotal { get; init; }
}

public sealed record DefectiveRow
{
    public Guid ProductId { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public int Quantity { get; init; }
    public decimal Value { get; init; }
}

public sealed record DefectiveSummary
{
    public int Quantity { get; init; }
    public decimal Value { get; init; }
    public IReadOnlyList<DefectiveRow> Rows { get; init; } = [];
}

public sealed record WriteOffRow
{
    public AdjustmentReason Reason { get; init; }
    public int Quantity { get; init; }
    public decimal Value { get; init; }
}

public sealed record ReturnsReport
{
    public string From { get; init; } = string.Empty;
    public string To { get; init; } = string.Empty;
    public int ReturnCount { get; init; }
    public decimal RefundTotal { get; init; }
    public IReadOnlyList<ReturnReasonRow> ByReason { get; init; } = [];
    public DefectiveSummary Defective { get; init; } = new();
    public IReadOnlyList<WriteOffRow> WriteOffs { get; init; } = [];
}

public sealed record CashierReportRow
{
    public Guid CashierId { get; init; }
    public string CashierName { get; init; } = string.Empty;
    public int ShiftCount { get; init; }
    public int OrderCount { get; init; }
    public decimal NetRevenue { get; init; }
    public int ReturnCount { get; init; }
    public decimal TotalDifference { get; init; }
}

public sealed record PaymentMethodReportRow
{
    public PaymentMethod Method { get; init; }
    public decimal Amount { get; init; }
    public int OrderCount { get; init; }
    public decimal Share { get; init; }
}
