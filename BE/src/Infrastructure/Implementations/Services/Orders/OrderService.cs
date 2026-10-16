using Application.Common.Exceptions;
using Application.Common.Models;
using Application.DTOs.Orders;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Roles;
using Application.Interfaces.Services.StoreProfile;
using Application.Mappings.Orders;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Returns;
using Domain.Entities.Pos.Shifts;
using Domain.Enums.Inventory.Stock;
using Domain.Enums.Pos.Approvals;
using Domain.Enums.Pos.Orders;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Orders;

/// <summary>
/// Bán hàng, thanh toán, tra cứu hóa đơn (UC-03..UC-06, UC-08, 07 §2.4). Thanh toán chạy đúng 9 bước 07 §2.4 trong
/// <see cref="IPosTransaction"/>: lệch Version hoặc trùng mã thì làm lại; trùng clientRequestId trả hóa đơn cũ (NFR-06, TC-29).
/// </summary>
public sealed class OrderService(
    IGenericRepository<Order> orders,
    IGenericRepository<Return> returns,
    IGenericRepository<Shift> shifts,
    IGenericRepository<Customer> customers,
    IGenericRepository<Product> products,
    IGenericRepository<ProductUnit> units,
    IGenericRepository<StockMovement> movements,
    IUnitOfWork unitOfWork,
    IPosTransaction transaction,
    IApprovalService approvals,
    IStoreProfileService storeProfile,
    ICurrentUserService currentUser,
    IPermissionService permissionService,
    TimeProvider timeProvider) : IOrderService
{
    public const string CodePrefix = "HD";

    private readonly PosAccess _access = new(currentUser, permissionService);

    private DateTime Now => timeProvider.GetUtcNow().UtcDateTime;

    public async Task<OrderQuote> QuoteAsync(CartInput request, CancellationToken ct = default)
    {
        var priced = await new CartPricer(products).PriceAsync(request.Lines, request.OrderDiscount, ct);
        var hasCustomer = request.CustomerId is { } customerId && await customers.AnyAsync(c => c.Id == customerId, ct);
        return ToQuote(priced, hasCustomer);
    }

    public async Task<CheckoutResult> CheckoutAsync(CheckoutRequest request, CancellationToken ct = default)
    {
        var userId = _access.UserId;
        var clientRequestId = request.ClientRequestId.Trim();
        var allowNegative = (await storeProfile.GetAsync(ct)).AllowNegativeStock;

        return await transaction.RunAsync(async token =>
        {
            // 1. Gửi lại cùng clientRequestId → hóa đơn cũ.
            if (await FindByClientRequestIdAsync(clientRequestId, token) is { } existing)
                return new CheckoutResult(await ToDtoAsync(existing, token), Created: false);

            // 2. Ca đang mở của người gọi.
            var shift = await shifts.QueryNoTracking().OpenShiftOfAsync(userId, token)
                ?? throw PosErrors.Create(PosErrors.ChuaMoCa, PosErrors.NoShiftForSaleMessage);

            // 3–4. Hàng, đơn vị, số lượng; tính tiền.
            var priced = await new CartPricer(products).PriceAsync(request.Lines, request.OrderDiscount, token);
            var cart = priced.Cart;
            var customer = await ResolveCustomerAsync(request.CustomerId, token);

            // 5. Vượt tồn khi tắt bán âm kho.
            CartPricer.EnsureStock(priced, allowNegative);

            // 6. Xác nhận của chủ cửa hàng.
            var reasons = cart.ApprovalReasons;
            (Guid Id, string Username)? approver = null;
            if (reasons.Count > 0)
            {
                if (string.IsNullOrWhiteSpace(request.ApprovalToken))
                {
                    throw PosErrors.Create(
                        PosErrors.CanXacNhan,
                        PosErrors.NeedApprovalMessage(reasons.Select(r => r.Text)),
                        extra: new Dictionary<string, object?> { ["approvalReasons"] = reasons });
                }

                approver = approvals.Peek(request.ApprovalToken, ApprovalAction.GiamGia)
                    ?? throw PosErrors.Create(PosErrors.MaXacNhanKhongHopLe, PosErrors.InvalidApprovalMessage);
            }

            // 7. Tổng FE đã hiển thị.
            if (cart.Total != request.ExpectedTotal)
                throw TotalChanged(cart.Total);

            // 8. Tiền khách đưa.
            var method = (PaymentMethod)(int)request.Payment.Method;
            if (method == PaymentMethod.TienMat && (request.Payment.CashReceived ?? 0) < cart.Total)
            {
                var missing = cart.Total - (request.Payment.CashReceived ?? 0);
                throw PosErrors.Create(PosErrors.TienKhongDu, PosErrors.CashShortMessage(missing), "payment.cashReceived");
            }

            // 9. Ghi hóa đơn, khoản thu, tồn, sổ biến động, điểm khách, tiêu token.
            var now = Now;
            var code = await NextCodeAsync(now, token);
            var points = customer is null ? 0 : PosRules.PointsFor(cart.Total);
            var order = Order.Create(
                new OrderHeader(
                    code, now, shift.Id, userId, shift.CashierName,
                    ClientRequestId: clientRequestId,
                    CustomerId: customer?.Id,
                    PointsEarned: points,
                    ApprovedById: approver?.Id,
                    ApprovedByName: approver?.Username,
                    ApprovalReasons: reasons.Count > 0 ? string.Join("; ", reasons.Select(r => r.Text)) : null,
                    QrContent: request.QrContent),
                cart);
            order.AddPayment(method, cart.Total, method == PaymentMethod.TienMat ? request.Payment.CashReceived : null, request.Payment.Reference);
            customer?.RecordOrder(points, cart.Total, now);

            var ledger = new StockLedger(products, units, movements);
            await ledger.LoadAsync(cart.Lines.Select(l => l.Input.ProductId), token);
            foreach (var line in cart.Lines)
            {
                ledger.Move(line.Input.ProductId, -line.BaseQty, MovementType.BanHang, order.Id, order.Code, now);
                ledger.MarkUnitUsed(line.Input.UnitId);
            }

            await ledger.FlushAsync(token);
            await orders.AddAsync(order, token);
            await unitOfWork.SaveChangesAsync(token);
            if (approver is not null)
                approvals.Consume(request.ApprovalToken, ApprovalAction.GiamGia);

            return new CheckoutResult(await LoadDtoAsync(order.Id, token), Created: true);
        }, ct);
    }

    public async Task<PaginatedResult<OrderListItem>> GetPagedAsync(OrderQuery query, CancellationToken ct = default)
    {
        var userId = _access.UserId;
        var source = orders.QueryNoTracking().WithListDetails();

        if (!await _access.CanViewAllAsync(ct))
        {
            // Thu ngân: chỉ hóa đơn thuộc ca do mình mở (07 §1); cashierId của người khác bỏ qua.
            source = source.Where(o => o.Shift!.CashierId == userId);
        }
        else if (query.CashierId is { } cashierId)
        {
            source = source.Where(o => o.CashierId == cashierId);
        }

        if (query.ShiftId is { } shiftId)
            source = source.Where(o => o.ShiftId == shiftId);

        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(o => AppDbFunctions.Matches(o.Code, pattern) || AppDbFunctions.Matches(o.Note, pattern));
        }

        var (from, to) = PosQueries.UtcRange(query.From, query.To);
        if (from is { } f)
            source = source.Where(o => o.PaidAt >= f);
        if (to is { } t)
            source = source.Where(o => o.PaidAt < t);
        if (query.PaymentMethod is { } method)
            source = source.Where(o => o.Payments.Any(p => p.Method == method));
        if (query.ReturnStatus is { } returnStatus)
            source = source.Where(o => o.ReturnStatus == returnStatus);
        if (query.CustomerId is { } customerId)
            source = source.Where(o => o.CustomerId == customerId);

        if (string.IsNullOrWhiteSpace(query.SortBy))
            query.SortBy = nameof(Order.PaidAt);

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        return page.Map(items => items.Select(o => o.ToListItem()).ToList());
    }

    public async Task<OrderDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var order = await orders.QueryNoTracking().WithDetails().FirstOrDefaultAsync(o => o.Id == id, ct)
            ?? throw new CodedNotFoundException(PosErrors.KhongThayHoaDon, "Không tìm thấy hóa đơn");
        await EnsureCanViewAsync(order, ct);
        return await ToDtoAsync(order, ct);
    }

    public async Task<OrderDto> GetByCodeAsync(string code, CancellationToken ct = default)
    {
        var normalized = code.Trim().ToUpperInvariant();
        var order = await orders.QueryNoTracking().WithDetails().FirstOrDefaultAsync(o => o.Code == normalized, ct)
            ?? throw new CodedNotFoundException(PosErrors.KhongThayHoaDon, PosErrors.OrderNotFoundMessage(code.Trim()));
        await EnsureCanViewAsync(order, ct);
        return await ToDtoAsync(order, ct);
    }

    public async Task<NextCodeDto> GetNextCodeAsync(CancellationToken ct = default) =>
        new() { Code = await NextCodeAsync(Now, ct) };

    internal static ConflictException TotalChanged(decimal serverTotal) =>
        new(PosErrors.TotalChangedMessage, null, new Dictionary<string, object?>
        {
            ["code"] = PosErrors.TongTienDaDoi,
            ["serverTotal"] = serverTotal
        });

    internal static OrderQuote ToQuote(PricedCartResult priced, bool hasCustomer)
    {
        var cart = priced.Cart;
        return new OrderQuote
        {
            Lines = cart.Lines.Select(l => new QuoteLine
            {
                ProductId = l.Input.ProductId,
                UnitId = l.Input.UnitId,
                ProductName = l.Input.ProductName,
                UnitName = l.Input.UnitName,
                Factor = l.Input.Factor,
                Quantity = l.Input.Quantity,
                BaseQty = l.BaseQty,
                UnitPrice = l.Input.UnitPrice,
                Amount = l.Amount,
                DiscountAmount = l.DiscountAmount,
                AllocatedDiscount = l.AllocatedDiscount,
                NetAmount = l.NetAmount
            }).ToList(),
            Subtotal = cart.Subtotal,
            LineDiscountTotal = cart.LineDiscountTotal,
            OrderDiscountAmount = cart.OrderDiscountAmount,
            DiscountTotal = cart.DiscountTotal,
            DiscountPct = cart.DiscountPct,
            Total = cart.Total,
            NeedsApproval = cart.NeedsApproval,
            ApprovalReasons = cart.ApprovalReasons,
            OverStock = priced.OverStock,
            PointsToEarn = hasCustomer ? PosRules.PointsFor(cart.Total) : 0
        };
    }

    private async Task EnsureCanViewAsync(Order order, CancellationToken ct)
    {
        if (order.Shift?.CashierId != _access.UserId && !await _access.CanViewAllAsync(ct))
            throw new ForbiddenException("Bạn chỉ xem được hóa đơn trong ca của mình (cần quyền shifts.view).");
    }

    private async Task<OrderDto> ToDtoAsync(Order order, CancellationToken ct)
    {
        DocumentRef? exchangeFor = null;
        if (order.ExchangeForReturnId is { } returnId)
        {
            exchangeFor = await returns.QueryNoTracking().Where(r => r.Id == returnId)
                .Select(r => new DocumentRef { Id = r.Id, Code = r.Code })
                .FirstOrDefaultAsync(ct);
        }

        return order.ToDto(await _access.CanViewCostAsync(ct), exchangeFor);
    }

    private async Task<OrderDto> LoadDtoAsync(Guid id, CancellationToken ct) =>
        await ToDtoAsync(await orders.QueryNoTracking().WithDetails().FirstAsync(o => o.Id == id, ct), ct);

    private Task<Order?> FindByClientRequestIdAsync(string clientRequestId, CancellationToken ct) =>
        orders.QueryNoTracking().WithDetails().FirstOrDefaultAsync(o => o.ClientRequestId == clientRequestId, ct);

    private Task<string> NextCodeAsync(DateTime atUtc, CancellationToken ct) =>
        DocCodes.NextAsync(orders.QueryNoTracking().Select(o => o.Code), CodePrefix, atUtc, 4, ct);

    private async Task<Customer?> ResolveCustomerAsync(Guid? customerId, CancellationToken ct)
    {
        if (customerId is not { } id)
            return null;

        return await customers.Query().FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw FieldErrors.Single("customerId", "Khách hàng không tồn tại");
    }
}
