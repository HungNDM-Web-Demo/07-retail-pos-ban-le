using System.Reflection;
using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.GoodsReceipts;
using Application.DTOs.Products;
using Application.DTOs.Reports;
using Application.DTOs.Stock;
using Application.Interfaces.Services.GoodsReceipts;
using Application.Interfaces.Services.Products;
using Application.Interfaces.Services.Reports;
using Application.Interfaces.Services.Stock;
using Domain.Common;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Pos;
using Domain.Enums.Inventory.GoodsReceipts;
using Domain.Enums.Inventory.Products;
using Domain.Enums.Inventory.Stock;
using Domain.Enums.Inventory.StockAdjustments;
using Infrastructure.Persistence.Seeders;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;
using static UnitTests.TestSupport.RetailScenario;

namespace UnitTests.Retail;

/// <summary>Hàng hóa (TC-01..TC-04), tồn kho, nhập hàng (TC-37..TC-41), tổng quan, báo cáo (TC-42, TC-45).</summary>
public sealed class InventoryAndReportTests : IAsyncLifetime
{
    private static readonly Guid Supplier2 = SeedIds.Stable("supplier", "NCC002");
    private RetailTestHost _host = null!;
    private RetailScenario _pos = null!;

    public async Task InitializeAsync()
    {
        _host = await RetailTestHost.StartAsync();
        _pos = new RetailScenario(_host);
        await _host.SignInAsync("quanly");
    }

    public async Task DisposeAsync() => await _host.DisposeAsync();

    private static SaveProductRequest PilsnerRequest(params SaveProductUnitInput[] units) => new()
    {
        Name = "Bia pilsner lon 330ml",
        GroupId = SeedIds.Stable("group", "BIA"),
        BaseUnit = "Lon",
        Barcode = "8939010030115",
        Price = 17_000,
        InitialCost = 14_000,
        MinStock = 24,
        Returnable = true,
        Units = units
    };

    [Fact]
    public async Task Tc01_CreateProductWithTwoUnits()
    {
        var product = await _host.CallAsync<IProductService, ProductDto>(s => s.CreateAsync(PilsnerRequest(
            new SaveProductUnitInput { Name = "Lốc 6", Factor = 6, Barcode = "8939010030122", Price = 99_000 },
            new SaveProductUnitInput { Name = "Thùng 24", Factor = 24, Barcode = "8939010030139", Price = 390_000 })));

        Assert.Equal("SP00301", product.Code);
        Assert.Equal((17.6m, false, 0, StockStatus.HetHang, "0 lon"), (product.MarginPct!.Value, product.IsLowMargin!.Value, product.Stock, product.StockStatus, product.StockText));
        Assert.Equal(3, product.Units.Count);
        Assert.Equal("#D97706", product.Color);

        var lookup = await _host.CallAsync<IProductService, ProductLookupDto>(s => s.LookupAsync("8939010030139"));
        Assert.Equal(product.Units.Single(u => u.Name == "Thùng 24").Id, lookup.UnitId);
        // Hàng tạo trong phiên không có dòng tồn đầu kỳ.
        Assert.False(await _host.QueryAsync<StockMovement, bool>(q => q.AnyAsync(m => m.ProductId == product.Id)));
    }

    [Fact]
    public async Task Tc02_DuplicateBarcode_409OnField()
    {
        var error = await Assert.ThrowsAsync<ConflictException>(() => _host.CallAsync<IProductService, ProductDto>(s => s.CreateAsync(PilsnerRequest(
            new SaveProductUnitInput { Name = "Lốc 6", Factor = 6, Barcode = "8939010001221", Price = 99_000 }))));
        Assert.Equal(("units[0].barcode", "Mã đã dùng cho Bia lager lon 330ml – Lốc 6", (object?)PosErrors.MaVachDaDung),
            (error.Field, error.Message, error.Extensions["code"]));
    }

    [Fact]
    public async Task Tc03_PriceStep_AndFactorRange()
    {
        var price = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IProductService, ProductDto>(s => s.CreateAsync(PilsnerRequest() with { Price = 17_200 })));
        Assert.Equal((PosErrors.GiaKhongHopLe, "Giá phải là bội số của 500 ₫"), (PosErrors.CodeOf(price), price.Message));

        var factor = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IProductService, ProductDto>(s => s.CreateAsync(PilsnerRequest(
            new SaveProductUnitInput { Name = "Thùng", Factor = 1, Price = 99_000 }))));
        Assert.Equal(PosErrors.DonViQuyDoiKhongHopLe, PosErrors.CodeOf(factor));
    }

    [Fact]
    public async Task Tc04_DeleteProductWithDocuments_Rejected_InternalBarcodeNext()
    {
        var error = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IProductService>(s => s.DeleteAsync(ProductId(Beer))));
        Assert.Equal((PosErrors.HangDaCoChungTu, "Mặt hàng đã có chứng từ, không xóa được. Chuyển sang Ngừng bán"), (PosErrors.CodeOf(error), error.Message));
        Assert.Equal("2000000000374", (await _host.CallAsync<IProductService, InternalBarcodeDto>(s => s.NextInternalBarcodeAsync())).Barcode);

        var beer = await _host.CallAsync<IProductService, ProductDto>(s => s.GetByIdAsync(ProductId(Beer)));
        Assert.True(beer.HasDocuments);
        Assert.All(beer.Units, u => Assert.True(u.EverUsed));
        var used = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IProductService, ProductDto>(s => s.UpdateAsync(beer.Id, new SaveProductRequest
        {
            Name = beer.Name, GroupId = beer.GroupId, BaseUnit = beer.BaseUnit, Barcode = beer.Barcode, Price = beer.Price, MinStock = beer.MinStock,
            Returnable = true, Units = beer.Units.Where(u => !u.IsBase).Select(u => new SaveProductUnitInput { Id = u.Id, Name = u.Name, Factor = u.Factor == 6 ? 12 : u.Factor, Barcode = u.Barcode, Price = u.Price }).ToList()
        })));
        Assert.Equal((PosErrors.DonViDaDung, "Đơn vị Lốc 6 đã có trong chứng từ, không xóa, không đổi hệ số"), (PosErrors.CodeOf(used), used.Message));
    }

    [Fact]
    public async Task Tc37_Tc38_MilkStockAndLots_DiscardLot()
    {
        var milk = (await _host.CallAsync<IStockService, Application.Common.Models.PaginatedResult<StockItem>>(s => s.GetPagedAsync(new StockQuery { Search = "sua tuoi tiet trung" }))).Items.Single(i => i.Code == Milk);
        Assert.Equal((120, "2 thùng 6 lốc", 780_000m), (milk.Stock, milk.StockText, milk.StockValue));

        var lots = await _host.CallAsync<IStockService, IReadOnlyList<StockLotDto>>(s => s.GetLotsAsync(new StockLotQuery()));
        var lot = lots.Single(l => l.ProductCode == Milk);
        Assert.Equal((24, 20, LotStatus.SapHetHan, 96), (lot.RemainingQty, lot.DaysLeft, lot.Status, lot.ReceivedQty));
        Assert.Equal(2, (await _host.CallAsync<IStockService, IReadOnlyList<StockLotDto>>(s => s.GetLotsAsync(new StockLotQuery { ProductId = ProductId(Milk) }))).Count);

        var adjustment = await _host.CallAsync<IStockAdjustmentService, StockAdjustmentDto>(s => s.CreateAsync(new CreateStockAdjustmentRequest
        {
            Reason = AdjustmentReason.HetHan,
            GoodsReceiptLineId = lot.GoodsReceiptLineId,
            Lines = [new StockAdjustmentLineInput { ProductId = ProductId(Milk), ActualQty = 96 }]
        }));
        var line = Assert.Single(adjustment.Lines);
        Assert.Equal(("DC261015001", -24, -156_000m), (adjustment.Code, line.Difference, line.Value));
        var product = await _pos.ProductAsync(Milk);
        Assert.Equal((96, 6_500m, "2 thùng"), (product.Stock, product.AvgCost, StockMath.StockText(product.Stock, product.UnitFactors())));
        lots = await _host.CallAsync<IStockService, IReadOnlyList<StockLotDto>>(s => s.GetLotsAsync(new StockLotQuery()));
        Assert.DoesNotContain(lots, l => l.ProductCode == Milk);

        var same = await Assert.ThrowsAsync<FluentValidation.ValidationException>(() => _host.CallAsync<IStockAdjustmentService, StockAdjustmentDto>(s => s.CreateAsync(new CreateStockAdjustmentRequest
        {
            Reason = AdjustmentReason.DemLai,
            Lines = [new StockAdjustmentLineInput { ProductId = ProductId(Milk), ActualQty = 96 }]
        })));
        Assert.Equal("Không có chênh lệch để điều chỉnh", Assert.Single(same.Errors).ErrorMessage);
    }

    [Fact]
    public async Task Tc39_ReceiptUpdatesAverageCost()
    {
        var draft = await _host.CallAsync<IGoodsReceiptService, GoodsReceiptDto>(s => s.CreateAsync(new SaveGoodsReceiptRequest
        {
            SupplierId = Supplier2,
            Lines = [new GoodsReceiptLineInput { ProductId = ProductId(Noodle), UnitId = UnitId(Noodle, 1), Quantity = 5, UnitPrice = 114_000 }]
        }));
        Assert.Equal(("PN261015001", 570_000m, GoodsReceiptStatus.Nhap), (draft.Code, draft.TotalAmount, draft.Status));

        var result = await _host.CallAsync<IGoodsReceiptService, ConfirmGoodsReceiptResult>(s => s.ConfirmAsync(draft.Id));
        var line = Assert.Single(result.Receipt.Lines);
        Assert.Equal((3_600m, 3_725m, 3_800m), (line.CostBefore!.Value, line.CostAfter!.Value, line.BaseUnitCost));
        Assert.Empty(result.LowMarginProducts);
        var noodle = await _host.CallAsync<IProductService, ProductDto>(s => s.GetByIdAsync(ProductId(Noodle)));
        Assert.Equal((240, "8 thùng", 3_725m, 17.2m), (noodle.Stock, noodle.StockText, noodle.AvgCost!.Value, noodle.MarginPct!.Value));
        var move = await _host.QueryAsync<StockMovement, StockMovement>(q => q.Where(m => m.ProductId == noodle.Id).OrderByDescending(m => m.Seq).FirstAsync());
        Assert.Equal((MovementType.NhapHang, 150, 240, 3_725m), (move.Type, move.Quantity, move.StockAfter, move.CostAfter));
    }

    [Fact]
    public async Task Tc40_LowMarginAfterReceipt_ThenRaisePrice()
    {
        var draft = await _host.CallAsync<IGoodsReceiptService, GoodsReceiptDto>(s => s.CreateAsync(new SaveGoodsReceiptRequest
        {
            SupplierId = SeedIds.Stable("supplier", "NCC001"),
            Lines = [new GoodsReceiptLineInput { ProductId = ProductId(Water), UnitId = UnitId(Water, 1), Quantity = 10, UnitPrice = 117_600 }]
        }));
        var result = await _host.CallAsync<IGoodsReceiptService, ConfirmGoodsReceiptResult>(s => s.ConfirmAsync(draft.Id));
        var low = Assert.Single(result.LowMarginProducts);
        Assert.Equal((Water, 4_773m, 4.5m), (low.Code, low.AvgCost, low.MarginPct));

        var updated = await _host.CallAsync<IProductService, ProductDto>(s => s.UpdatePricesAsync(low.ProductId, new UpdateProductPricesRequest
        {
            Prices = [new UnitPriceInput { UnitId = UnitId(Water, 0), Price = 5_500 }]
        }));
        Assert.Equal((13.2m, false), (updated.MarginPct!.Value, updated.IsLowMargin!.Value));
    }

    [Fact]
    public async Task Tc41_ExpiryRequiredOnConfirm_ConfirmedReceiptLocked()
    {
        var request = new SaveGoodsReceiptRequest
        {
            SupplierId = SeedIds.Stable("supplier", "NCC003"),
            Lines = [new GoodsReceiptLineInput { ProductId = ProductId(Milk), UnitId = UnitId(Milk, 2), Quantity = 1, UnitPrice = 312_000 }]
        };
        var draft = await _host.CallAsync<IGoodsReceiptService, GoodsReceiptDto>(s => s.CreateAsync(request));
        var missing = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IGoodsReceiptService, ConfirmGoodsReceiptResult>(s => s.ConfirmAsync(draft.Id)));
        Assert.Equal((PosErrors.ThieuHanSuDung, "Nhập hạn sử dụng"), (PosErrors.CodeOf(missing), missing.Message));

        var withExpiry = request with { Lines = [request.Lines[0] with { ExpiryDate = new DateOnly(2027, 3, 1) }] };
        await _host.CallAsync<IGoodsReceiptService, GoodsReceiptDto>(s => s.UpdateAsync(draft.Id, withExpiry));
        var confirmed = await _host.CallAsync<IGoodsReceiptService, ConfirmGoodsReceiptResult>(s => s.ConfirmAsync(draft.Id));
        Assert.Equal(GoodsReceiptStatus.DaNhapKho, confirmed.Receipt.Status);
        Assert.Equal(168, (await _pos.ProductAsync(Milk)).Stock);

        var locked = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IGoodsReceiptService, GoodsReceiptDto>(s => s.UpdateAsync(draft.Id, withExpiry)));
        Assert.Equal((PosErrors.PhieuDaNhapKho, "Phiếu đã nhập kho, không sửa, không xóa"), (PosErrors.CodeOf(locked), locked.Message));
        await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IGoodsReceiptService>(s => s.DeleteAsync(draft.Id)));
    }

    [Fact]
    public async Task Tc42_DashboardUpdatesAfterSale()
    {
        var before = await _host.CallAsync<IReportService, DashboardDto>(s => s.GetDashboardAsync());
        Assert.Equal(0, before.Today.OrderCount);
        Assert.Equal(7, before.Last7Days.Count);
        Assert.Equal(14, before.LowStockCount);
        Assert.Equal((8, 1), (before.ExpiringLotCount, before.ExpiredLotCount));

        await _pos.OpenShiftAsync();
        var approval = await _pos.ApproveAsync("quanly", Domain.Enums.Pos.Approvals.ApprovalAction.GiamGia);
        await _pos.CheckoutAsync(Checkout([Line(Beer, 2, 1)], 390_000, orderDiscount: Amount(20_000), token: approval.Token));

        await _host.SignInAsync("quanly");
        var after = await _host.CallAsync<IReportService, DashboardDto>(s => s.GetDashboardAsync());
        Assert.Equal((390_000m, 18_000m, 1), (after.Today.NetRevenue - before.Today.NetRevenue, after.Today.GrossProfit - before.Today.GrossProfit, after.Today.OrderCount));
        Assert.Equal((Beer, 24), (after.TopProducts[0].Code, after.TopProducts[0].Quantity));
    }

    [Fact]
    public async Task Tc45_GroupProfitsSumToRevenueTotals()
    {
        var range = new DateRangeQuery { From = "2026-09-15", To = "2026-10-14" };
        var revenue = await _host.CallAsync<IReportService, RevenueReport>(s => s.GetRevenueAsync(range));
        var groups = await _host.CallAsync<IReportService, GroupProfitReport>(s => s.GetGroupsAsync(range));
        Assert.Equal(revenue.Totals.GrossProfit, groups.Rows.Sum(r => r.GrossProfit));
        Assert.Equal(revenue.Totals.NetRevenue, groups.Totals.NetRevenue);
        Assert.All(groups.Rows.Where(r => r.NetRevenue != 0), r => Assert.Equal(Math.Round(r.GrossProfit / r.NetRevenue * 100, 1, MidpointRounding.AwayFromZero), r.MarginPct));

        var products = await _host.CallAsync<IReportService, Application.Common.Models.PaginatedResult<ProductProfitRow>>(s => s.GetProductsAsync(new ProductProfitQuery { From = range.From, To = range.To, PageSize = 100 }));
        Assert.Equal(1, products.Items[0].Rank);
        var methods = await _host.CallAsync<IReportService, IReadOnlyList<PaymentMethodReportRow>>(s => s.GetPaymentMethodsAsync(range));
        Assert.Equal(revenue.Totals.SalesTotal, methods.Sum(m => m.Amount));
        var cashiers = await _host.CallAsync<IReportService, IReadOnlyList<CashierReportRow>>(s => s.GetCashiersAsync(range));
        Assert.Equal(2, cashiers.Count);
        Assert.Equal(revenue.Totals.NetRevenue, cashiers.Sum(c => c.NetRevenue));
    }

    [Fact]
    public void ProjectPermissions_AreDeclaredInSeed()
    {
        var seeded = SystemSeedData.Embedded.Permissions.Select(p => p.Code).ToHashSet();
        var missing = typeof(ProjectPermissions).GetNestedTypes(BindingFlags.Public | BindingFlags.Static)
            .SelectMany(t => t.GetFields(BindingFlags.Public | BindingFlags.Static))
            .Where(f => f is { IsLiteral: true } && f.FieldType == typeof(string))
            .Select(f => (string)f.GetRawConstantValue()!)
            .Where(code => !seeded.Contains(code))
            .ToList();
        Assert.Empty(missing);
    }
    [Fact]
    public async Task Suppliers_SortByPurchaseStats()
    {
        // Cột số liệu nhập không phải cột bảng: trước đây BE bỏ qua sortBy, danh sách sai thứ tự (bản lỗi khi đối chiếu FE).
        foreach (var sortBy in new[] { "totalPurchased", "receiptCount", "lastReceiptAt" })
        {
            var page = await _host.CallAsync<ISupplierService, PaginatedResult<SupplierDto>>(s =>
                s.GetPagedAsync(new PaginationQuery { SortBy = sortBy, SortDir = "desc", PageSize = 100 }));
            var keys = page.Items.Select(d => sortBy switch
            {
                "totalPurchased" => d.TotalPurchased,
                "receiptCount" => d.ReceiptCount,
                _ => (decimal)(d.LastReceiptAt?.Ticks ?? 0)
            }).ToList();
            Assert.True(page.TotalCount > 1);
            Assert.Equal(keys.OrderByDescending(k => k).ToList(), keys);
            Assert.True(keys[0] > keys[^1]);
        }

        var asc = await _host.CallAsync<ISupplierService, PaginatedResult<SupplierDto>>(s =>
            s.GetPagedAsync(new PaginationQuery { SortBy = "totalPurchased", SortDir = "asc", Page = 1, PageSize = 2 }));
        Assert.Equal(2, asc.Items.Count);
        Assert.True(asc.TotalCount > 2);
        Assert.True(asc.Items[0].TotalPurchased <= asc.Items[1].TotalPurchased);
    }
}
