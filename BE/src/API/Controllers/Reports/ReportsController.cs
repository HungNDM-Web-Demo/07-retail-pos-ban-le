using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Reports;
using Application.Interfaces.Services.Reports;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Reports;

/// <summary>Tổng quan, báo cáo (FR-01, FR-02, FR-36..FR-38, 07 §2.10). Gắn <c>reports.view</c>, không dùng <c>dashboard.view</c>.</summary>
[Route("api/reports")]
[AuthorizePermission(ProjectPermissions.Reports.View)]
public sealed class ReportsController(IReportService service) : PosApiController
{
    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardDto>> GetDashboard(CancellationToken ct) => Ok(await service.GetDashboardAsync(ct));

    [HttpGet("revenue")]
    public async Task<ActionResult<RevenueReport>> GetRevenue([FromQuery] DateRangeQuery query, CancellationToken ct) => Ok(await service.GetRevenueAsync(query, ct));

    [HttpGet("groups")]
    public async Task<ActionResult<GroupProfitReport>> GetGroups([FromQuery] DateRangeQuery query, CancellationToken ct) => Ok(await service.GetGroupsAsync(query, ct));

    [HttpGet("products")]
    public async Task<ActionResult<PaginatedResult<ProductProfitRow>>> GetProducts([FromQuery] ProductProfitQuery query, CancellationToken ct) =>
        Ok(await service.GetProductsAsync(query, ct));

    [HttpGet("returns")]
    public async Task<ActionResult<ReturnsReport>> GetReturns([FromQuery] ReturnsReportQuery query, CancellationToken ct) => Ok(await service.GetReturnsAsync(query, ct));

    [HttpGet("cashiers")]
    public async Task<ActionResult<IReadOnlyList<CashierReportRow>>> GetCashiers([FromQuery] DateRangeQuery query, CancellationToken ct) =>
        Ok(await service.GetCashiersAsync(query, ct));

    [HttpGet("payment-methods")]
    public async Task<ActionResult<IReadOnlyList<PaymentMethodReportRow>>> GetPaymentMethods([FromQuery] DateRangeQuery query, CancellationToken ct) =>
        Ok(await service.GetPaymentMethodsAsync(query, ct));
}
