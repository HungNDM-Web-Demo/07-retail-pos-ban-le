using Application.Common.Models;
using Application.DTOs.Reports;

namespace Application.Interfaces.Services.Reports;

/// <summary>Tổng quan, báo cáo doanh thu, lợi nhuận (FR-01, FR-02, FR-36..FR-38, BR-30, 07 §2.10, §3.9).</summary>
public interface IReportService
{
    Task<DashboardDto> GetDashboardAsync(CancellationToken ct = default);

    Task<RevenueReport> GetRevenueAsync(DateRangeQuery query, CancellationToken ct = default);

    Task<GroupProfitReport> GetGroupsAsync(DateRangeQuery query, CancellationToken ct = default);

    Task<PaginatedResult<ProductProfitRow>> GetProductsAsync(ProductProfitQuery query, CancellationToken ct = default);

    Task<ReturnsReport> GetReturnsAsync(ReturnsReportQuery query, CancellationToken ct = default);

    Task<IReadOnlyList<CashierReportRow>> GetCashiersAsync(DateRangeQuery query, CancellationToken ct = default);

    Task<IReadOnlyList<PaymentMethodReportRow>> GetPaymentMethodsAsync(DateRangeQuery query, CancellationToken ct = default);
}
