using Application.Common.Exceptions;
using Application.DTOs.Orders;
using Application.DTOs.Products;
using Application.DTOs.Settings;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Products;
using Application.Interfaces.Services.Settings;
using Domain.Common;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Inventory.Products;
using Domain.Enums.Inventory.Stock;
using Domain.Enums.Pos.Approvals;
using Domain.Enums.Pos.Orders;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;
using static UnitTests.TestSupport.RetailScenario;

namespace UnitTests.Retail;

/// <summary>Bán hàng, giảm giá, xác nhận, thanh toán (05: TC-04, TC-06, TC-19, TC-22..TC-29).</summary>
public sealed class OrderFlowTests : IAsyncLifetime
{
    private RetailTestHost _host = null!;
    private RetailScenario _pos = null!;

    public async Task InitializeAsync()
    {
        _host = await RetailTestHost.StartAsync();
        _pos = new RetailScenario(_host);
    }

    public async Task DisposeAsync() => await _host.DisposeAsync();

    [Fact]
    public async Task Tc06_CheckoutWithoutShift_ChuaMoCa()
    {
        await _host.SignInAsync("thungan");
        var error = await Assert.ThrowsAsync<DomainException>(() => _pos.CheckoutAsync(Checkout(Tc21Cart(), 84_500)));
        Assert.Equal((PosErrors.ChuaMoCa, "Chưa mở ca, mở ca trước khi bán hàng"), (PosErrors.CodeOf(error), error.Message));
    }

    [Fact]
    public async Task Tc25_CashCheckout_StockCostAndCode()
    {
        await _pos.OpenShiftAsync();
        var result = await _pos.CheckoutAsync(Checkout(Tc21Cart(), 84_500, cash: 100_000));

        var order = result.Order;
        Assert.True(result.Created);
        Assert.Equal("HD2610150001", order.Code);
        var payment = Assert.Single(order.Payments);
        Assert.Equal((PaymentMethod.TienMat, 84_500m, 100_000m, 15_500m), (payment.Method, payment.Amount, payment.CashReceived!.Value, payment.ChangeAmount!.Value));
        // Thu ngân không có products.view-cost → giá vốn null.
        Assert.Null(order.CostTotal);

        await _host.SignInAsync("quanly");
        var detail = await _host.CallAsync<IOrderService, OrderDto>(s => s.GetByIdAsync(order.Id));
        Assert.Equal([46_500m, 18_000m, 6_500m], detail.Lines.Select(l => l.CostAmount!.Value));
        Assert.Equal(71_000m, detail.CostTotal);
        Assert.Equal((47, 85, 119), ((await _pos.ProductAsync(Beer)).Stock, (await _pos.ProductAsync(Noodle)).Stock, (await _pos.ProductAsync(Milk)).Stock));
        Assert.True((await _pos.ProductAsync(Beer)).Units.Single(u => u.IsBase).EverUsed);
    }

    [Fact]
    public async Task Tc22_Tc24_OverLimitDiscount_NeedsManagerApproval()
    {
        await _pos.OpenShiftAsync();
        var cart = new[] { Line(Beer, 2, 1) };
        var quote = await _host.CallAsync<IOrderService, OrderQuote>(s => s.QuoteAsync(new CartInput { Lines = cart, OrderDiscount = Amount(30_000) }));
        Assert.True(quote.NeedsApproval);
        Assert.Equal("Giảm 7,3%, vượt hạn mức 5%", Assert.Single(quote.ApprovalReasons).Text);
        Assert.Equal((380_000m, 7.3m), (quote.Total, quote.DiscountPct));

        var missing = await Assert.ThrowsAsync<DomainException>(() => _pos.CheckoutAsync(Checkout(cart, 380_000, orderDiscount: Amount(30_000))));
        Assert.Equal(PosErrors.CanXacNhan, PosErrors.CodeOf(missing));
        Assert.Equal("Cần chủ cửa hàng xác nhận: Giảm 7,3%, vượt hạn mức 5%", missing.Message);

        // TC-24: thu ngân tự xác nhận → 403.
        var forbidden = await Assert.ThrowsAsync<CodedForbiddenException>(() => _pos.ApproveAsync("thungan", ApprovalAction.GiamGia));
        Assert.Equal((PosErrors.KhongCoQuyenXacNhan, "Tài khoản không có quyền xác nhận giảm giá"), (forbidden.Code, forbidden.Message));

        var wrong = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IApprovalService, ApprovalDto>(s =>
            s.ApproveAsync(new ApprovalRequest { Username = "quanly", Password = "sai", Action = ApprovalAction.GiamGia })));
        Assert.Equal(PosErrors.SaiTaiKhoanXacNhan, PosErrors.CodeOf(wrong));

        var approval = await _pos.ApproveAsync("quanly", ApprovalAction.GiamGia);
        Assert.Equal("quanly", approval.ApprovedByName);
        var paid = await _pos.CheckoutAsync(Checkout(cart, 380_000, orderDiscount: Amount(30_000), token: approval.Token));
        Assert.Equal((380_000m, "quanly"), (paid.Order.Total, paid.Order.ApprovedByName));

        // Token dùng một lần.
        var reused = await Assert.ThrowsAsync<DomainException>(() => _pos.CheckoutAsync(Checkout(cart, 380_000, orderDiscount: Amount(30_000), token: approval.Token)));
        Assert.Equal(PosErrors.MaXacNhanKhongHopLe, PosErrors.CodeOf(reused));
    }

    [Fact]
    public async Task ApprovalToken_ExpiresAfter15Minutes_AndIsBoundToAction()
    {
        await _pos.OpenShiftAsync();
        var cart = new[] { Line(Beer, 2, 1) };
        var returnToken = await _pos.ApproveAsync("quanly", ApprovalAction.DoiTra);
        var wrongAction = await Assert.ThrowsAsync<DomainException>(() => _pos.CheckoutAsync(Checkout(cart, 380_000, orderDiscount: Amount(30_000), token: returnToken.Token)));
        Assert.Equal(PosErrors.MaXacNhanKhongHopLe, PosErrors.CodeOf(wrongAction));

        var token = await _pos.ApproveAsync("quanly", ApprovalAction.GiamGia);
        _host.Time.Advance(TimeSpan.FromMinutes(16));
        var expired = await Assert.ThrowsAsync<DomainException>(() => _pos.CheckoutAsync(Checkout(cart, 380_000, orderDiscount: Amount(30_000), token: token.Token)));
        Assert.Equal(PosErrors.MaXacNhanKhongHopLe, PosErrors.CodeOf(expired));
    }

    [Fact]
    public async Task Tc23_BelowCost_NeedsApproval()
    {
        await _pos.OpenShiftAsync();
        var quote = await _host.CallAsync<IOrderService, OrderQuote>(s => s.QuoteAsync(new CartInput { Lines = [Line(Formula, 0, 1)], OrderDiscount = Percent(4) }));
        Assert.Equal((18_000m, 437_000m), (quote.OrderDiscountAmount, quote.Total));
        var reason = Assert.Single(quote.ApprovalReasons);
        Assert.Equal((ApprovalReasonCode.DuoiGiaVon, "Thấp hơn giá vốn 3.000 ₫"), (reason.Code, reason.Text));
    }

    [Fact]
    public async Task Tc26_CashShort_And_TotalChanged()
    {
        await _pos.OpenShiftAsync();
        var shortError = await Assert.ThrowsAsync<DomainException>(() => _pos.CheckoutAsync(Checkout(Tc21Cart(), 84_500, cash: 80_000)));
        Assert.Equal((PosErrors.TienKhongDu, "Còn thiếu 4.500 ₫"), (PosErrors.CodeOf(shortError), shortError.Message));

        var changed = await Assert.ThrowsAsync<ConflictException>(() => _pos.CheckoutAsync(Checkout(Tc21Cart(), 80_000)));
        Assert.Equal((PosErrors.TongTienDaDoi, 84_500m), (changed.Extensions["code"], changed.Extensions["serverTotal"]));
    }

    [Fact]
    public async Task Tc29_SameClientRequestId_CreatesOneOrder()
    {
        await _pos.OpenShiftAsync();
        var request = Checkout([Line(Beer, 0, 1)], 18_000, clientRequestId: "tc29-request");
        var first = await _pos.CheckoutAsync(request);
        var second = await _pos.CheckoutAsync(request);

        Assert.True(first.Created);
        Assert.False(second.Created);
        Assert.Equal(first.Order.Id, second.Order.Id);
        Assert.Equal(49, (await _pos.ProductAsync(Beer)).Stock);
    }

    [Fact]
    public async Task Tc27_SellCaseThenCans_MovementsAndStatus()
    {
        await _pos.OpenShiftAsync();
        await _pos.CheckoutAsync(Checkout([Line(Beer, 2, 1)], 410_000));
        await _pos.CheckoutAsync(Checkout([Line(Beer, 0, 3)], 54_000));

        var beer = await _pos.ProductAsync(Beer);
        Assert.Equal((23, StockStatus.SapHet), (beer.Stock, beer.StockStatus));
        var moves = await _host.QueryAsync<StockMovement, List<StockMovement>>(q => q.Where(m => m.ProductId == beer.Id)
            .OrderByDescending(m => m.Seq).Take(2).ToListAsync());
        Assert.Equal([(-3, 23), (-24, 26)], moves.Select(m => (m.Quantity, m.StockAfter)));
        Assert.All(moves, m => Assert.Equal(MovementType.BanHang, m.Type));
    }

    [Fact]
    public async Task Tc19_OverStock_AllowedThenBlocked()
    {
        await _pos.OpenShiftAsync();
        var quote = await _host.CallAsync<IOrderService, OrderQuote>(s => s.QuoteAsync(new CartInput { Lines = [Line(Eggs, 0, 3)] }));
        var over = Assert.Single(quote.OverStock);
        Assert.Equal((1, "Hộp"), (over.Shortage, over.BaseUnit));
        await _pos.CheckoutAsync(Checkout([Line(Eggs, 0, 3)], 96_000));
        var eggs = await _pos.ProductAsync(Eggs);
        Assert.Equal((-1, StockStatus.AmKho), (eggs.Stock, eggs.StockStatus));

        await _host.SignInAsync("admin");
        await _host.CallAsync<ISettingService>(s => s.UpdateAsync(new UpdateSettingsRequest { Items = [new UpdateSettingItem { Key = "Pos.AllowNegativeStock", Value = "false" }] }));
        await _host.SignInAsync("thungan");
        var blocked = await Assert.ThrowsAsync<DomainException>(() => _pos.CheckoutAsync(Checkout([Line(Eggs, 0, 1)], 32_000)));
        Assert.Equal((PosErrors.VuotTon, "Vượt tồn 1 hộp: Trứng gà sạch hộp 10 quả"), (PosErrors.CodeOf(blocked), blocked.Message));
    }

    [Fact]
    public async Task Tc04_InactiveProduct_HangNgungBan()
    {
        await _host.SignInAsync("quanly");
        await _host.CallAsync<IProductService>(s => s.SetStatusAsync(ProductId(Beer), new ProductStatusRequest { Status = ProductStatus.NgungBan }));
        await _pos.OpenShiftAsync();
        var error = await Assert.ThrowsAsync<DomainException>(() => _pos.CheckoutAsync(Checkout([Line(Beer, 0, 1)], 18_000)));
        Assert.Equal((PosErrors.HangNgungBan, "Hàng ngừng bán: Bia lager lon 330ml"), (PosErrors.CodeOf(error), error.Message));
    }

    [Fact]
    public async Task CashierScope_SeesOnlyOwnShiftOrders()
    {
        var userId = await _host.SignInAsync("thungan");
        await _pos.OpenShiftAsync();
        var mine = await _pos.CheckoutAsync(Checkout([Line(Beer, 0, 1)], 18_000));
        var own = await _host.QueryAsync<Order, int>(q => q.CountAsync(o => o.Shift!.CashierId == userId));
        var page = await _host.CallAsync<IOrderService, Application.Common.Models.PaginatedResult<OrderListItem>>(s => s.GetPagedAsync(new OrderQuery { PageSize = 100 }));
        Assert.Equal(own, page.TotalCount);
        Assert.Equal(mine.Order.Id, page.Items[0].Id);

        // Hóa đơn trong ca của thu ngân khác → 403.
        var other = await _host.QueryAsync<Order, Guid>(q => q.Where(o => o.Shift!.CashierId != userId).Select(o => o.Id).FirstAsync());
        await Assert.ThrowsAsync<ForbiddenException>(() => _host.CallAsync<IOrderService, OrderDto>(s => s.GetByIdAsync(other)));

        await _host.SignInAsync("quanly");
        var all = await _host.CallAsync<IOrderService, Application.Common.Models.PaginatedResult<OrderListItem>>(s => s.GetPagedAsync(new OrderQuery()));
        Assert.Equal(4_992, all.TotalCount);
    }

    [Fact]
    public async Task Catalog_HasNoCost_IncludesInactive_VersionChangesAfterSale()
    {
        await _pos.OpenShiftAsync();
        var before = await _host.CallAsync<IPosCatalogService, PosCatalog>(s => s.GetAsync());
        Assert.Equal(300, before.Items.Count);
        Assert.Equal(4, before.Items.Count(i => i.Status == ProductStatus.NgungBan));
        var beer = before.Items.Single(i => i.Code == Beer);
        Assert.Equal(["8939010001214", "8939010001221", "8939010001238"], beer.Units.Select(u => u.Barcode));
        Assert.Contains("bia lager", beer.SearchText);

        await _pos.CheckoutAsync(Checkout([Line(Beer, 0, 1)], 18_000));
        Assert.NotEqual(before.Version, await _host.CallAsync<IPosCatalogService, string>(s => s.GetVersionAsync()));
    }
}
