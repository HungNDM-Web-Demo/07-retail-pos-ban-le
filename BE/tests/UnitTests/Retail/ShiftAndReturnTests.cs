using Application.Common.Exceptions;
using Application.DTOs.Orders;
using Application.DTOs.Reports;
using Application.DTOs.Returns;
using Application.DTOs.Shifts;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Reports;
using Application.Interfaces.Services.Returns;
using Application.Interfaces.Services.Shifts;
using Domain.Common;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Pos.Approvals;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Returns;
using Domain.Enums.Pos.Shifts;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;
using static UnitTests.TestSupport.RetailScenario;

namespace UnitTests.Retail;

/// <summary>Ca (TC-05, TC-07..TC-11) và đổi trả (TC-30..TC-36, TC-44).</summary>
public sealed class ShiftAndReturnTests : IAsyncLifetime
{
    private RetailTestHost _host = null!;
    private RetailScenario _pos = null!;

    public async Task InitializeAsync()
    {
        _host = await RetailTestHost.StartAsync();
        _pos = new RetailScenario(_host);
    }

    public async Task DisposeAsync() => await _host.DisposeAsync();

    private static CloseShiftRequest Count(string? note, params (int Denomination, int Count)[] items) =>
        new() { CashCount = items.Select(i => new CashCountItem { Denomination = i.Denomination, Count = i.Count }).ToList(), Note = note };

    /// <summary>TC-07 bước 1–4: mở ca 500.000, HĐ tiền mặt 84.500, HĐ chuyển khoản 410.000, trả 1 Lốc 4 sữa HĐ B hoàn 31.000.</summary>
    private async Task Tc07ShiftAsync()
    {
        var shift = await _pos.OpenShiftAsync();
        Assert.Equal("CA26101502", shift.Code);
        await _pos.CheckoutAsync(Checkout(Tc21Cart(), 84_500, cash: 100_000));
        await _pos.CheckoutAsync(Checkout([Line(Beer, 2, 1)], 410_000, TenderMethod.ChuyenKhoan));
        var b = await _pos.SampleOrderAsync('B');
        var ret = await _pos.CreateReturnAsync(Return(b, 1, 1, 31_000));
        Assert.Equal(31_000m, ret.Return.RefundTotal);
    }

    [Fact]
    public async Task Tc05_OpenShift_ThenOpenAgainReturnsSame()
    {
        await _host.SignInAsync("thungan");
        Assert.Null(await _host.CallAsync<IShiftService, ShiftDto?>(s => s.GetCurrentAsync()));
        var first = await _host.CallAsync<IShiftService, OpenShiftResult>(s => s.OpenAsync(new OpenShiftRequest { OpeningCash = 500_000 }));
        var second = await _host.CallAsync<IShiftService, OpenShiftResult>(s => s.OpenAsync(new OpenShiftRequest { OpeningCash = 500_000 }));
        Assert.True(first.Created);
        Assert.False(second.Created);
        Assert.Equal((first.Shift.Id, ShiftStatus.DangMo), (second.Shift.Id, second.Shift.Status));
    }

    [Fact]
    public async Task Tc07_CloseMatchingCash()
    {
        await Tc07ShiftAsync();
        var current = (await _host.CallAsync<IShiftService, ShiftDto?>(s => s.GetCurrentAsync()))!;
        Assert.Equal((2, 1, 84_500m, 410_000m, 0m), (current.OrderCount, current.ReturnCount, current.SalesByMethod["TienMat"], current.SalesByMethod["ChuyenKhoan"], current.SalesByMethod["The"]));
        Assert.Equal((31_000m, 553_500m), (current.RefundByMethod["TienMat"], current.ExpectedCash));

        var closed = await _host.CallAsync<IShiftService, ShiftDto>(s => s.CloseCurrentAsync(Count(null, (500_000, 1), (50_000, 1), (2_000, 1), (1_000, 1), (500, 1))));
        Assert.Equal((ShiftStatus.DaChot, 553_500m, 0m), (closed.Status, closed.CountedCash!.Value, closed.Difference!.Value));
        Assert.Equal(5, closed.CashCount!.Count);
    }

    [Fact]
    public async Task Tc08_Tc11_LargeDifference_NeedsNote_ThenReview()
    {
        await Tc07ShiftAsync();
        var noNote = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IShiftService, ShiftDto>(s => s.CloseCurrentAsync(Count(null, (500_000, 1), (20_000, 1), (10_000, 1)))));
        Assert.Equal((PosErrors.CanGhiChu, "Chênh lệch quá 20.000 ₫, cần ghi chú"), (PosErrors.CodeOf(noNote), noNote.Message));

        var closed = await _host.CallAsync<IShiftService, ShiftDto>(s => s.CloseCurrentAsync(Count("Thối nhầm", (500_000, 1), (20_000, 1), (10_000, 1))));
        Assert.Equal((ShiftStatus.CanKiemTra, -23_500m), (closed.Status, closed.Difference!.Value));

        // Thu ngân xem chi tiết ca của mình được.
        var mine = await _host.CallAsync<IShiftService, ShiftDetail>(s => s.GetByIdAsync(closed.Id));
        Assert.Equal((2, 1), (mine.Orders.Count, mine.Returns.Count));

        await _host.SignInAsync("quanly");
        var reviewed = await _host.CallAsync<IShiftService, ShiftDto>(s => s.ReviewAsync(closed.Id, new ReviewShiftRequest { Note = "Đã nhắc thu ngân" }));
        Assert.Equal((ShiftStatus.DaKiemTra, "Đã nhắc thu ngân", "Trần Thị Mai"), (reviewed.Status, reviewed.ReviewNote, reviewed.ReviewedByName));
        var again = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IShiftService, ShiftDto>(s => s.ReviewAsync(closed.Id, new ReviewShiftRequest { Note = "x" })));
        Assert.Equal(PosErrors.CaKhongCanKiemTra, PosErrors.CodeOf(again));
    }

    [Fact]
    public async Task Tc09_SmallDifference_ClosesWithoutNote()
    {
        await Tc07ShiftAsync();
        var closed = await _host.CallAsync<IShiftService, ShiftDto>(s => s.CloseCurrentAsync(Count(null, (500_000, 1), (20_000, 2))));
        Assert.Equal((ShiftStatus.DaChot, -13_500m), (closed.Status, closed.Difference!.Value));
    }

    [Fact]
    public async Task Tc30_Tc44_ReturnDiscountedLine_RestocksAndReportsToday()
    {
        await _host.SignInAsync("quanly");
        var aDayBefore = await _host.CallAsync<IReportService, RevenueReport>(s => s.GetRevenueAsync(new DateRangeQuery { From = "2026-10-13", To = "2026-10-13" }));
        await _pos.OpenShiftAsync();
        var a = await _pos.SampleOrderAsync('A');
        var result = await _pos.CreateReturnAsync(Return(a, 1, 1, 389_500));
        Assert.Equal(("TH2610150001", 389_500m, 389_500m), (result.Return.Code, result.Return.RefundTotal, result.Return.PayoutAmount));

        var beer = await _pos.ProductAsync(Beer);
        Assert.Equal((74, 15_500m), (beer.Stock, beer.AvgCost));
        Assert.Equal("3 thùng 2 lon", StockMath.StockText(beer.Stock, beer.UnitFactors()));
        Assert.Equal(OrderReturnStatus.TraMotPhan, (await _pos.SampleOrderAsync('A')).ReturnStatus);

        await _host.SignInAsync("quanly");
        var today = await _host.CallAsync<IReportService, RevenueReport>(s => s.GetRevenueAsync(new DateRangeQuery { From = "2026-10-15", To = "2026-10-15" }));
        Assert.Equal((389_500m, -389_500m, -372_000m, -17_500m), (today.Totals.RefundTotal, today.Totals.NetRevenue, today.Totals.Cogs, today.Totals.GrossProfit));
        var aDay = await _host.CallAsync<IReportService, RevenueReport>(s => s.GetRevenueAsync(new DateRangeQuery { From = "2026-10-13", To = "2026-10-13" }));
        Assert.Equal(aDayBefore.Totals, aDay.Totals);
    }

    [Fact]
    public async Task Tc31_ExchangeWithCustomerPayingMore()
    {
        await _pos.OpenShiftAsync();
        var b = await _pos.SampleOrderAsync('B');
        var exchange = new ExchangeInput
        {
            Lines = [new ExchangeLineInput { ProductId = ProductId(Beer), UnitId = UnitId(Beer, 1), Quantity = 1 }],
            ExpectedTotal = 105_000,
            Payment = new TenderInput { Method = TenderMethod.TienMat, CashReceived = 100_000 }
        };
        var result = await _pos.CreateReturnAsync(Return(b, 1, 1, 31_000, exchange: exchange));
        var ret = result.Return;
        Assert.Equal((31_000m, 31_000m, 0m, 74_000m), (ret.RefundTotal, ret.OffsetAmount, ret.PayoutAmount, ret.Difference));
        Assert.Equal(105_000m, ret.ExchangeOrder!.Total);

        var order = await _host.QueryAsync<Order, Order>(q => q.Include(o => o.Payments).SingleAsync(o => o.Id == ret.ExchangeOrder.Id));
        Assert.Equal(ret.Id, order.ExchangeForReturnId);
        var payments = order.Payments.OrderBy(p => p.Method).ToList();
        Assert.Equal((PaymentMethod.TienMat, 74_000m, 26_000m), (payments[0].Method, payments[0].Amount, payments[0].ChangeAmount!.Value));
        Assert.Equal((PaymentMethod.BuTruDoiHang, 31_000m), (payments[1].Method, payments[1].Amount));
        Assert.Equal((124, 44), ((await _pos.ProductAsync(Milk)).Stock, (await _pos.ProductAsync(Beer)).Stock));

        var shift = (await _host.CallAsync<IShiftService, ShiftDto?>(s => s.GetCurrentAsync()))!;
        Assert.Equal((74_000m, 31_000m, 31_000m, 0m), (shift.SalesByMethod["TienMat"], shift.SalesByMethod["BuTruDoiHang"], shift.RefundByMethod["BuTruDoiHang"], shift.RefundByMethod["TienMat"]));
    }

    [Fact]
    public async Task Tc32_DefectiveReturn_NoRestock_InReport()
    {
        await _pos.OpenShiftAsync();
        var b = await _pos.SampleOrderAsync('B');
        var result = await _pos.CreateReturnAsync(Return(b, 2, 2, 16_000, ReturnCondition.HangLoi, ReturnReason.Khac, "Phồng hộp"));
        Assert.Equal(16_000m, result.Return.RefundTotal);
        Assert.Equal(120, (await _pos.ProductAsync(Milk)).Stock);

        var source = await _host.CallAsync<IReturnService, ReturnSourceOrder>(s => s.GetSourceAsync(b.Code));
        Assert.Equal(2, source.Lines.Single(l => l.LineNo == 2).ReturnableQty);

        await _host.SignInAsync("quanly");
        var report = await _host.CallAsync<IReportService, ReturnsReport>(s => s.GetReturnsAsync(new ReturnsReportQuery { From = "2026-10-15", To = "2026-10-15" }));
        Assert.Equal((2, 13_000m), (report.Defective.Quantity, report.Defective.Value));
    }

    [Fact]
    public async Task Tc33_Tc36_NotReturnable_AndOverQuantity()
    {
        await _pos.OpenShiftAsync();
        var b = await _pos.SampleOrderAsync('B');
        var source = await _host.CallAsync<IReturnService, ReturnSourceOrder>(s => s.GetSourceAsync(b.Code));
        var egg = source.Lines.Single(l => l.LineNo == 3);
        Assert.Equal((false, 0), (egg.Returnable, egg.ReturnableQty));
        Assert.Equal((1, false), (source.DaysSince, source.NeedsApproval));

        var notReturnable = await Assert.ThrowsAsync<DomainException>(() => _pos.CreateReturnAsync(Return(b, 3, 1, 32_000)));
        Assert.Equal((PosErrors.HangKhongDoiTra, "Hàng không đổi trả"), (PosErrors.CodeOf(notReturnable), notReturnable.Message));

        var tooMany = await Assert.ThrowsAsync<DomainException>(() => _pos.CreateReturnAsync(Return(b, 1, 3, 62_000)));
        Assert.Equal((PosErrors.VuotSoLuongTra, "Tối đa 2"), (PosErrors.CodeOf(tooMany), tooMany.Message));
    }

    [Fact]
    public async Task Tc34_OlderThan7Days_NeedsApproval_OlderThan30_Rejected()
    {
        await _pos.OpenShiftAsync();
        var c = await _pos.SampleOrderAsync('C');
        var source = await _host.CallAsync<IReturnService, ReturnSourceOrder>(s => s.GetSourceAsync(c.Code));
        Assert.Equal((10, true, "Hóa đơn 10 ngày, cần chủ cửa hàng xác nhận"), (source.DaysSince, source.NeedsApproval, source.ApprovalText));

        var missing = await Assert.ThrowsAsync<DomainException>(() => _pos.CreateReturnAsync(Return(c, 1, 1, 105_000)));
        Assert.Equal(PosErrors.CanXacNhan, PosErrors.CodeOf(missing));

        var token = await _pos.ApproveAsync("quanly", ApprovalAction.DoiTra);
        var ok = await _pos.CreateReturnAsync(Return(c, 1, 1, 105_000, token: token.Token));
        Assert.Equal((105_000m, "quanly"), (ok.Return.RefundTotal, ok.Return.ApprovedByName));

        var d = await _pos.SampleOrderAsync('D');
        var late = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IReturnService, ReturnSourceOrder>(s => s.GetSourceAsync(d.Code)));
        Assert.Equal((PosErrors.QuaHanDoiTra, "Hóa đơn đã quá 30 ngày, không nhận đổi trả"), (PosErrors.CodeOf(late), late.Message));
    }

    [Fact]
    public async Task Tc35_LargeRefund_NeedsApproval_AndUnknownCode404()
    {
        await _pos.OpenShiftAsync();
        var e = await _pos.SampleOrderAsync('E');
        var error = await Assert.ThrowsAsync<DomainException>(() => _pos.CreateReturnAsync(Return(e, 1, 2, 820_000)));
        Assert.Equal("Cần chủ cửa hàng xác nhận: Tiền hoàn trên 500.000 ₫, cần chủ cửa hàng xác nhận", error.Message);

        var notFound = await Assert.ThrowsAsync<CodedNotFoundException>(() => _host.CallAsync<IReturnService, ReturnSourceOrder>(s => s.GetSourceAsync("HD0000000000")));
        Assert.Equal((PosErrors.KhongThayHoaDon, "Không tìm thấy hóa đơn HD0000000000"), (notFound.Code, notFound.Message));
    }

    [Fact]
    public async Task ReturnWithoutShift_ChuaMoCa()
    {
        await _host.SignInAsync("thungan");
        var b = await _pos.SampleOrderAsync('B');
        var error = await Assert.ThrowsAsync<DomainException>(() => _pos.CreateReturnAsync(Return(b, 1, 1, 31_000)));
        Assert.Equal((PosErrors.ChuaMoCa, "Mở ca trước khi đổi trả"), (PosErrors.CodeOf(error), error.Message));
    }
}
