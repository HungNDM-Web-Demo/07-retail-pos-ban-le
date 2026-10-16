using Application.DTOs.Reports;
using Application.DTOs.Stock;
using Application.Interfaces.Services.Reports;
using Application.Interfaces.Services.Stock;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.StockAdjustments;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Returns;
using Domain.Entities.Pos.Shifts;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Returns;
using Domain.Enums.Pos.Shifts;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;

namespace UnitTests.Retail;

/// <summary>Dữ liệu mẫu khớp số đối chiếu 06 §5.5 (lúc 06:30 hôm nay: chưa có hóa đơn hôm nay).</summary>
public sealed class RetailSeedTests : IAsyncLifetime
{
    private RetailTestHost _host = null!;

    public async Task InitializeAsync()
    {
        _host = await RetailTestHost.StartAsync();
        await _host.SignInAsync("quanly");
    }

    public async Task DisposeAsync() => await _host.DisposeAsync();

    [Fact]
    public async Task Counts_MatchDesign()
    {
        Assert.Equal(300, await _host.QueryAsync<Product, int>(q => q.CountAsync()));
        Assert.Equal(423, await _host.QueryAsync<ProductUnit, int>(q => q.CountAsync()));
        Assert.Equal(4_991, await _host.QueryAsync<Order, int>(q => q.CountAsync()));
        Assert.Equal(80, await _host.QueryAsync<Return, int>(q => q.CountAsync()));
        Assert.Equal(21, await _host.QueryAsync<ReturnLine, int>(q => q.CountAsync(l => l.Condition == ReturnCondition.HangLoi)));
        Assert.Equal(15, await _host.QueryAsync<Order, int>(q => q.CountAsync(o => o.ExchangeForReturnId != null)));
        Assert.Equal(40, await _host.QueryAsync<GoodsReceipt, int>(q => q.CountAsync()));
        Assert.Equal(1_546, await _host.QueryAsync<GoodsReceiptLine, int>(q => q.CountAsync()));
        Assert.Equal(12, await _host.QueryAsync<StockAdjustment, int>(q => q.CountAsync()));
        Assert.Equal(15_654, await _host.QueryAsync<StockMovement, int>(q => q.CountAsync()));
        // 06:30: 179 ca (ca chiều hôm nay chưa mở), ca sáng hôm nay đang mở.
        Assert.Equal(179, await _host.QueryAsync<Shift, int>(q => q.CountAsync()));
        Assert.Equal(1, await _host.QueryAsync<Shift, int>(q => q.CountAsync(s => s.Status == ShiftStatus.DangMo)));
        Assert.Equal(1, await _host.QueryAsync<Shift, int>(q => q.CountAsync(s => s.Status == ShiftStatus.CanKiemTra)));
        Assert.Equal(5, await _host.QueryAsync<Shift, int>(q => q.CountAsync(s => s.Status == ShiftStatus.DaKiemTra)));
    }

    [Fact]
    public async Task Revenue89Days_MatchesReconciliation()
    {
        var report = await _host.CallAsync<IReportService, RevenueReport>(s => s.GetRevenueAsync(new DateRangeQuery { From = "2026-07-18", To = "2026-10-14" }));
        Assert.Equal(89, report.Days.Count);
        Assert.Equal(681_982_500m, report.Totals.SalesTotal);
        Assert.Equal(2_865_269m, report.Totals.RefundTotal);
        Assert.Equal(679_117_231m, report.Totals.NetRevenue);
        Assert.Equal(569_933_500m - 2_381_100m, report.Totals.Cogs);
        Assert.Equal(111_564_831m, report.Totals.GrossProfit);
        Assert.Equal(16.4m, report.Totals.MarginPct);
    }

    [Fact]
    public async Task Revenue30Days_MatchesReconciliation()
    {
        var report = await _host.CallAsync<IReportService, RevenueReport>(s => s.GetRevenueAsync(new DateRangeQuery { From = "2026-09-15", To = "2026-10-14" }));
        Assert.Equal((246_724_000m, 701_103m, 246_022_897m, 40_107_397m),
            (report.Totals.SalesTotal, report.Totals.RefundTotal, report.Totals.NetRevenue, report.Totals.GrossProfit));
    }

    [Fact]
    public async Task StockSummary_MatchesReconciliation()
    {
        var summary = await _host.CallAsync<IStockService, StockSummary>(s => s.GetSummaryAsync(new StockSummaryQuery { IncludeInactive = true }));
        Assert.Equal(196_411_700m, summary.TotalValue);
        Assert.Equal((1, 3, 10, 282), (summary.ByStatus["AmKho"], summary.ByStatus["HetHang"], summary.ByStatus["SapHet"], summary.ByStatus["ConHang"]));
        Assert.Equal((8, 1), (summary.ExpiringLotCount, summary.ExpiredLotCount));
    }

    [Fact]
    public async Task SampleOrders_AndTestProducts()
    {
        var totals = await _host.QueryAsync<Order, Dictionary<string, decimal>>(q => q.Where(o => o.Note != null && o.Note.StartsWith("HĐ mẫu"))
            .ToDictionaryAsync(o => o.Note!, o => o.Total));
        Assert.Equal(503_500m, totals["HĐ mẫu A"]);
        Assert.Equal(126_000m, totals["HĐ mẫu B"]);
        Assert.Equal(105_000m, totals["HĐ mẫu C"]);
        Assert.Equal(120_000m, totals["HĐ mẫu D"]);
        Assert.Equal(820_000m, totals["HĐ mẫu E"]);

        var stock = await _host.QueryAsync<Product, Dictionary<string, (int, decimal)>>(q =>
            q.Where(p => new[] { "SP00012", "SP00031", "SP00045", "SP00048", "SP00058", "SP00077", "SP00102" }.Contains(p.Code))
                .ToDictionaryAsync(p => p.Code, p => (p.Stock, p.AvgCost)));
        Assert.Equal((50, 15_500m), stock["SP00012"]);
        Assert.Equal((90, 3_600m), stock["SP00031"]);
        Assert.Equal((120, 6_500m), stock["SP00045"]);
        Assert.Equal((60, 6_100m), stock["SP00048"]);
        Assert.Equal((24, 3_500m), stock["SP00058"]);
        Assert.Equal((6, 440_000m), stock["SP00077"]);
        Assert.Equal((2, 27_000m), stock["SP00102"]);

        var a = await _host.QueryAsync<Order, Order>(q => q.Include(o => o.Payments).SingleAsync(o => o.Note == "HĐ mẫu A"));
        var payment = Assert.Single(a.Payments);
        Assert.Equal((PaymentMethod.TienMat, 503_500m, 510_000m, 6_500m), (payment.Method, payment.Amount, payment.CashReceived!.Value, payment.ChangeAmount!.Value));
    }

    [Fact]
    public async Task FullDayLoad_At2300_HasAllOrders()
    {
        await using var host = await RetailTestHost.StartFreshAsync(new DateTimeOffset(2026, 10, 15, 16, 0, 0, TimeSpan.Zero));
        Assert.Equal(5_046, await host.QueryAsync<Order, int>(q => q.CountAsync()));
        Assert.Equal(13_885, await host.QueryAsync<OrderLine, int>(q => q.CountAsync()));
        Assert.Equal(5_053, await host.QueryAsync<OrderPayment, int>(q => q.CountAsync()));
        Assert.Equal(180, await host.QueryAsync<Shift, int>(q => q.CountAsync()));
        var todayStart = new DateTime(2026, 10, 14, 17, 0, 0, DateTimeKind.Utc);
        Assert.Equal(6_734_000m, (await host.QueryAsync<Order, List<decimal>>(q => q.Where(o => o.PaidAt >= todayStart).Select(o => o.Total).ToListAsync())).Sum());
        Assert.Equal(15_654 + 13_885 - 13_742, await host.QueryAsync<StockMovement, int>(q => q.CountAsync()));
    }
}
