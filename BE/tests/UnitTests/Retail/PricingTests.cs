using Domain.Common;
using Domain.Entities.Pos;
using Domain.Enums.Inventory.Stock;
using Domain.Enums.Pos.Approvals;
using Domain.Enums.Pos.Orders;
using Infrastructure.Persistence.Seeders;

namespace UnitTests.Retail;

/// <summary>Công thức tiền, tồn, mã vạch (07 §3, bảng số tính sẵn §3.11).</summary>
public sealed class PricingTests
{
    private const string Nbsp = " ";

    private static PricingLineInput Line(decimal price, int quantity, int factor = 1, decimal cost = 0, DiscountSpec? discount = null) =>
        new(Guid.NewGuid(), "SP", "Hàng", Guid.Empty, Guid.NewGuid(), "Đơn vị", factor, price, cost, true, quantity, discount);

    [Fact]
    public void Tc13_ThreeUnitsOfBeer_Total533000()
    {
        var cart = OrderPricing.Price([Line(18_000, 1), Line(105_000, 1, 6), Line(410_000, 1, 24)], null);
        Assert.Equal(533_000m, cart.Total);
    }

    [Fact]
    public void Tc14_Lines_Total94500()
    {
        var cart = OrderPricing.Price([Line(18_000, 2), Line(4_500, 13)], null);
        Assert.Equal((36_000m, 58_500m, 94_500m), (cart.Lines[0].Amount, cart.Lines[1].Amount, cart.Total));
    }

    [Fact]
    public void Tc21_FivePercent_RoundsDownTo500_NoApproval()
    {
        var cart = OrderPricing.Price(
            [Line(18_000, 3, cost: 15_500), Line(4_500, 5, cost: 3_600), Line(8_000, 1, cost: 6_500)],
            new DiscountSpec(DiscountType.PhanTram, 5, DiscountReason.KhachQuen));
        Assert.Equal((84_500m, 4_000m, 80_500m, 4.7m), (cart.Subtotal, cart.OrderDiscountAmount, cart.Total, cart.DiscountPct));
        Assert.False(cart.NeedsApproval);
    }

    [Fact]
    public void Tc22_Discount30000_OnBeerCase_NeedsApproval()
    {
        var cart = OrderPricing.Price([Line(410_000, 1, 24, 15_500)], new DiscountSpec(DiscountType.SoTien, 30_000, DiscountReason.KhachQuen));
        Assert.Equal(380_000m, cart.Total);
        var reason = Assert.Single(cart.ApprovalReasons);
        Assert.Equal((ApprovalReasonCode.VuotHanMuc, "Giảm 7,3%, vượt hạn mức 5%"), (reason.Code, reason.Text));
    }

    [Fact]
    public void Tc23_FourPercentBelowCost_NeedsApproval()
    {
        var cart = OrderPricing.Price([Line(455_000, 1, cost: 440_000)], new DiscountSpec(DiscountType.PhanTram, 4, DiscountReason.KhachQuen));
        Assert.Equal((18_000m, 437_000m), (cart.OrderDiscountAmount, cart.Total));
        var reason = Assert.Single(cart.ApprovalReasons);
        Assert.Equal((ApprovalReasonCode.DuoiGiaVon, $"Thấp hơn giá vốn 3.000{Nbsp}₫"), (reason.Code, reason.Text));
    }

    [Fact]
    public void Tc25_CostOfLines()
    {
        var cart = OrderPricing.Price([Line(18_000, 3, cost: 15_500), Line(4_500, 5, cost: 3_600), Line(8_000, 1, cost: 6_500)], null);
        Assert.Equal([46_500m, 18_000m, 6_500m], cart.Lines.Select(l => l.CostAmount));
        Assert.Equal(71_000m, cart.CostTotal);
    }

    [Fact]
    public void DemoStep4_FivePointOnePercent_NeedsApproval()
    {
        var cart = OrderPricing.Price([Line(18_000, 1), Line(105_000, 1, 6), Line(410_000, 1, 24), Line(4_500, 12)], new DiscountSpec(DiscountType.SoTien, 30_000, DiscountReason.KhachQuen));
        Assert.Equal((587_000m, 557_000m), (cart.Subtotal, cart.Total));
        Assert.Equal("Giảm 5,1%, vượt hạn mức 5%", Assert.Single(cart.ApprovalReasons).Text);
    }

    [Fact]
    public void SampleA_AllocatesOrderDiscount()
    {
        var cart = OrderPricing.Price([Line(410_000, 1, 24, 15_500), Line(120_000, 1, 30, 3_600)], new DiscountSpec(DiscountType.PhanTram, 5, DiscountReason.KhachQuen));
        Assert.Equal(26_500m, cart.OrderDiscountAmount);
        Assert.Equal([20_500m, 6_000m], cart.Lines.Select(l => l.AllocatedDiscount));
        Assert.Equal([389_500m, 114_000m], cart.Lines.Select(l => l.NetAmount));
        Assert.Equal([372_000m, 108_000m], cart.Lines.Select(l => l.CostAmount));
        Assert.Equal(503_500m, cart.Total);
    }

    [Fact]
    public void AmountDiscountAboveBase_IsRejected()
    {
        var error = Assert.Throws<DomainException>(() => OrderPricing.Price([Line(18_000, 1)], new DiscountSpec(DiscountType.SoTien, 20_000, DiscountReason.KhachQuen)));
        Assert.Equal((PosErrors.GiamQuaTongTien, "Số tiền giảm lớn hơn tổng tiền hàng"), (PosErrors.CodeOf(error), error.Message));
    }

    [Theory]
    [InlineData(389_500, 0, 1, 0, 1, 389_500)] // TC-30 trả hết dòng
    [InlineData(62_000, 0, 2, 0, 1, 31_000)] // TC-31 trả 1/2 Lốc 4
    [InlineData(32_000, 0, 4, 0, 2, 16_000)] // TC-32 trả 2/4 hộp
    [InlineData(10_001, 5_000, 3, 1, 2, 5_001)] // trả nốt phần còn lại: lấy phần thuần còn lại (lẻ)
    public void Br18_RefundForLine(decimal net, decimal refunded, int quantity, int returned, int q, decimal expected) =>
        Assert.Equal(expected, OrderPricing.RefundForLine(net, refunded, quantity, returned, q));

    [Theory]
    [InlineData(90, 3_600, 150, 3_800, 3_725)] // TC-39
    [InlineData(24, 3_500, 240, 4_900, 4_773)] // TC-40
    [InlineData(78, 3_600, 150, 3_800, 3_732)] // Demo bước 11
    [InlineData(50, 15_500, 24, 15_500, 15_500)] // TC-30 trả hàng
    [InlineData(-3, 1_000, 10, 1_200, 1_200)] // tồn âm → lấy giá nhập
    public void Br23_NextAvgCost(int stock, decimal cost, int qIn, decimal unitCost, decimal expected) =>
        Assert.Equal(expected, StockMath.NextAvgCost(stock, cost, qIn, unitCost));

    [Theory]
    [InlineData(50, "2 thùng 2 lon")]
    [InlineData(26, "1 thùng 2 lon")]
    [InlineData(23, "3 lốc 5 lon")]
    [InlineData(74, "3 thùng 2 lon")]
    [InlineData(0, "0 lon")]
    [InlineData(-3, "−3 lon")]
    public void Br02_StockText_Beer(int stock, string expected) =>
        Assert.Equal(expected, StockMath.StockText(stock, [new UnitFactor("Lon", 1), new UnitFactor("Lốc 6", 6), new UnitFactor("Thùng 24", 24)]));

    [Theory]
    [InlineData(120, "2 thùng 6 lốc")]
    [InlineData(96, "2 thùng")]
    public void Br02_StockText_Milk(int stock, string expected) =>
        Assert.Equal(expected, StockMath.StockText(stock, [new UnitFactor("Hộp", 1), new UnitFactor("Lốc 4", 4), new UnitFactor("Thùng 48", 48)]));

    [Fact]
    public void Br25_Br26_MarginAndStatus()
    {
        Assert.Equal(17.6m, StockMath.MarginPct(17_000, 14_000));
        Assert.Equal(4.5m, StockMath.MarginPct(5_000, 4_773));
        Assert.Equal(13.2m, StockMath.MarginPct(5_500, 4_773));
        Assert.Equal(3.3m, StockMath.MarginPct(455_000, 440_000));
        Assert.Equal(17.2m, StockMath.MarginPct(4_500, 3_725));
        Assert.Equal(StockStatus.SapHet, StockMath.StatusOf(23, 24));
        Assert.Equal(StockStatus.ConHang, StockMath.StatusOf(26, 24));
        Assert.Equal(StockStatus.AmKho, StockMath.StatusOf(-1, 5));
        Assert.Equal(StockStatus.HetHang, StockMath.StatusOf(0, 5));
    }

    [Fact]
    public void Br27_Lots_NewestFirst()
    {
        var today = new DateOnly(2026, 10, 15);
        var lots = StockMath.EstimateLots(120, [
            new LotInput(Guid.NewGuid(), today.AddDays(-40), null, 1, 96, today.AddDays(20)),
            new LotInput(Guid.NewGuid(), today.AddDays(-10), null, 1, 96, today.AddDays(150))
        ], today);
        Assert.Equal((96, LotStatus.ConHan), (lots[0].RemainingQty, lots[0].Status));
        Assert.Equal((24, LotStatus.SapHetHan, 20), (lots[1].RemainingQty, lots[1].Status, lots[1].DaysLeft));
    }

    [Fact]
    public void Br03_Barcodes()
    {
        Assert.Equal("2000000000374", Barcodes.NextInternal(["2000000000015", "2000000000367", "8939010001214", null]));
        Assert.Equal(4, Barcodes.Ean13CheckDigit("200000000037"));
        Assert.True(Barcodes.IsValidFormat("89390100"));
        Assert.False(Barcodes.IsValidFormat("1234567"));
    }

    [Fact]
    public void SeedIds_MatchFrontendStableId()
    {
        // Giá trị tính bằng stableId() của FE (src/mock/mock-helpers.ts).
        Assert.Equal(Guid.Parse("a90a0c3c-d3c1-44ca-a341-1b624bb04532"), SeedIds.Stable("product", "SP00012"));
        Assert.Equal(Guid.Parse("4f6feb97-72e3-46f1-aef5-1919c97fb4c9"), SeedIds.Stable("unit", "SP00012", 2));
        Assert.Equal(Guid.Parse("f8c14620-ffa0-4216-a173-ae9eab65314e"), SeedIds.Stable("shift", -89, 1));
        Assert.Equal(Guid.Parse("1c5f6225-7bb4-436b-af03-e0e3068cdb33"), SeedIds.Stable("order", 0));
    }

    [Fact]
    public void NormalizeVi_MatchesFrontend()
    {
        Assert.Equal("mi goi tom chua cay 75g sp00031", VietnameseText.Normalize("Mì gói tôm chua cay 75g SP00031"));
        Assert.Equal("nguyen thi dep", VietnameseText.Normalize("  Nguyễn   Thị ĐẸP "));
        Assert.Equal($"1.234.500{Nbsp}₫", PosRules.FormatVnd(1_234_500));
    }
}
