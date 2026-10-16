using Application.DTOs.Orders;
using Application.DTOs.Returns;
using Application.DTOs.Shifts;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Returns;
using Application.Interfaces.Services.Shifts;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Pos.Approvals;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Returns;
using Infrastructure.Persistence.Seeders;
using Microsoft.EntityFrameworkCore;

namespace UnitTests.TestSupport;

/// <summary>Thao tác dùng lại trong test: Id hàng mẫu, mở ca, thanh toán, xác nhận, đổi trả.</summary>
public sealed class RetailScenario(RetailTestHost host)
{
    public const string Beer = "SP00012";
    public const string Noodle = "SP00031";
    public const string Milk = "SP00045";
    public const string Water = "SP00058";
    public const string Formula = "SP00077";
    public const string Eggs = "SP00102";

    public RetailTestHost Host => host;

    public static Guid ProductId(string code) => SeedIds.Stable("product", code);

    /// <summary>Đơn vị thứ <paramref name="index"/> (0 cơ bản, 1–3 quy đổi).</summary>
    public static Guid UnitId(string code, int index) => SeedIds.Stable("unit", code, index);

    public static CartLineInput Line(string code, int unit, int quantity, DiscountInput? discount = null) =>
        new() { ProductId = ProductId(code), UnitId = UnitId(code, unit), Quantity = quantity, Discount = discount };

    /// <summary>TC-21: 3 lon bia + 5 gói mì + 1 hộp sữa = 84.500 ₫.</summary>
    public static IReadOnlyList<CartLineInput> Tc21Cart() => [Line(Beer, 0, 3), Line(Noodle, 0, 5), Line(Milk, 0, 1)];

    public static DiscountInput Amount(decimal value) => new() { Type = DiscountType.SoTien, Value = value, Reason = DiscountReason.KhachQuen };

    public static DiscountInput Percent(decimal value) => new() { Type = DiscountType.PhanTram, Value = value, Reason = DiscountReason.KhachQuen };

    public async Task<ShiftDto> OpenShiftAsync(string username = "thungan", decimal openingCash = 500_000)
    {
        await host.SignInAsync(username);
        var result = await host.CallAsync<IShiftService, OpenShiftResult>(s => s.OpenAsync(new OpenShiftRequest { OpeningCash = openingCash }));
        return result.Shift;
    }

    public static CheckoutRequest Checkout(
        IReadOnlyList<CartLineInput> lines,
        decimal expectedTotal,
        TenderMethod method = TenderMethod.TienMat,
        decimal? cash = null,
        DiscountInput? orderDiscount = null,
        string? token = null,
        string? clientRequestId = null) => new()
    {
        Lines = lines,
        OrderDiscount = orderDiscount,
        ClientRequestId = clientRequestId ?? Guid.NewGuid().ToString(),
        Payment = new TenderInput { Method = method, CashReceived = method == TenderMethod.TienMat ? cash ?? expectedTotal : null },
        ApprovalToken = token,
        ExpectedTotal = expectedTotal
    };

    public Task<CheckoutResult> CheckoutAsync(CheckoutRequest request) =>
        host.CallAsync<IOrderService, CheckoutResult>(s => s.CheckoutAsync(request));

    public Task<ApprovalDto> ApproveAsync(string username, ApprovalAction action) =>
        host.CallAsync<IApprovalService, ApprovalDto>(s => s.ApproveAsync(new ApprovalRequest { Username = username, Password = RetailTestHost.DemoPassword, Action = action }));

    public Task<Product> ProductAsync(string code) =>
        host.QueryAsync<Product, Product>(q => q.Include(p => p.Units).SingleAsync(p => p.Code == code));

    /// <summary>Hóa đơn mẫu "HĐ mẫu A"…"E" kèm dòng.</summary>
    public Task<Order> SampleOrderAsync(char letter) =>
        host.QueryAsync<Order, Order>(q => q.Include(o => o.Lines).SingleAsync(o => o.Note == $"HĐ mẫu {letter}"));

    public static CreateReturnRequest Return(Order order, int lineNo, int quantity, decimal expectedRefund,
        ReturnCondition condition = ReturnCondition.BanLaiDuoc, ReturnReason reason = ReturnReason.KhachDoiY, string? note = null,
        string? token = null, ExchangeInput? exchange = null, RefundMethod method = RefundMethod.TienMat) => new()
    {
        ClientRequestId = Guid.NewGuid().ToString(),
        OrderId = order.Id,
        Lines = [new ReturnLineInput { OrderLineId = order.Lines.Single(l => l.LineNo == lineNo).Id, Quantity = quantity, Condition = condition, Reason = reason, Note = note }],
        RefundMethod = method,
        ApprovalToken = token,
        ExpectedRefundTotal = expectedRefund,
        Exchange = exchange
    };

    public Task<CreateReturnResult> CreateReturnAsync(CreateReturnRequest request) =>
        host.CallAsync<IReturnService, CreateReturnResult>(s => s.CreateAsync(request));
}
