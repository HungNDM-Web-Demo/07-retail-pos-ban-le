using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Common.Time;
using Application.DTOs.Orders;
using Application.DTOs.Returns;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Returns;
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
using Domain.Enums.Pos.Returns;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Common;
using Infrastructure.Implementations.Services.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Returns;

/// <summary>
/// Đổi trả (UC-07, BR-17..BR-20, 07 §2.6, §3.6): tiền hoàn theo phần thuần của dòng gốc; hàng bán lại được nhập lại kho theo
/// giá vốn dòng gốc (BR-19); có hàng đổi thì tạo hóa đơn đổi với khoản bù trừ (BR-20).
/// </summary>
public sealed class ReturnService(
    IGenericRepository<Return> returns,
    IGenericRepository<Order> orders,
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
    TimeProvider timeProvider) : IReturnService
{
    public const string CodePrefix = "TH";

    private readonly PosAccess _access = new(currentUser, permissionService);

    private DateTime Now => timeProvider.GetUtcNow().UtcDateTime;

    public static string ApprovalText(int daysSince) => $"Hóa đơn {daysSince} ngày, cần chủ cửa hàng xác nhận";

    public const string LargeRefundText = "Tiền hoàn trên 500.000 ₫, cần chủ cửa hàng xác nhận";

    public async Task<ReturnSourceOrder> GetSourceAsync(string code, CancellationToken ct = default)
    {
        var normalized = code.Trim().ToUpperInvariant();
        var order = await orders.QueryNoTracking().WithListDetails().FirstOrDefaultAsync(o => o.Code == normalized, ct)
            ?? throw new CodedNotFoundException(PosErrors.KhongThayHoaDon, PosErrors.OrderNotFoundMessage(code.Trim()));

        var daysSince = EnsureReturnable(order);
        return new ReturnSourceOrder
        {
            OrderId = order.Id,
            Code = order.Code,
            PaidAt = order.PaidAt,
            DaysSince = daysSince,
            CashierName = order.CashierName,
            Total = order.Total,
            Payments = order.Payments.Select(p => p.ToDto()).ToList(),
            Customer = order.Customer is { } c ? new CustomerRef { Id = c.Id, Phone = c.Phone, Name = c.Name } : null,
            Lines = order.Lines.OrderBy(l => l.LineNo).Select(l => new ReturnSourceLine
            {
                OrderLineId = l.Id,
                LineNo = l.LineNo,
                ProductId = l.ProductId,
                ProductName = l.ProductName,
                UnitId = l.UnitId,
                UnitName = l.UnitName,
                Factor = l.Factor,
                Quantity = l.Quantity,
                ReturnedQty = l.ReturnedQty,
                ReturnableQty = l.ReturnableQty,
                NetAmount = l.NetAmount,
                RefundedAmount = l.RefundedAmount,
                UnitNetPrice = PosRules.RoundVnd(l.NetAmount / l.Quantity),
                Returnable = l.Returnable
            }).ToList(),
            NeedsApproval = daysSince > PosRules.FreeReturnDays,
            ApprovalText = daysSince > PosRules.FreeReturnDays ? ApprovalText(daysSince) : null
        };
    }

    public async Task<PaginatedResult<ReturnSourceListItem>> GetSourceOrdersAsync(ReturnSourceQuery query, CancellationToken ct = default)
    {
        var today = VietnamDates.Today(timeProvider);
        var minPaidAt = VietnamDates.StartOfDayUtc(today.AddDays(-PosRules.MaxReturnDays));
        var source = orders.QueryNoTracking().Include(o => o.Lines)
            .Where(o => o.PaidAt >= minPaidAt && o.ReturnStatus != OrderReturnStatus.TraHet);

        if (VietnamDates.TryParse(query.Date, out var date))
        {
            var start = VietnamDates.StartOfDayUtc(date);
            var end = VietnamDates.EndOfDayExclusiveUtc(date);
            source = source.Where(o => o.PaidAt >= start && o.PaidAt < end);
        }

        if (query.ProductId is { } productId)
            source = source.Where(o => o.Lines.Any(l => l.ProductId == productId));

        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(o => AppDbFunctions.Matches(o.Code, pattern) || AppDbFunctions.Matches(o.Note, pattern));
        }

        query.SortBy = nameof(Order.PaidAt);
        query.SortDir = "desc";
        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        return page.Map(items => items.Select(o => new ReturnSourceListItem
        {
            OrderId = o.Id,
            Code = o.Code,
            PaidAt = o.PaidAt,
            Total = o.Total,
            ItemCount = o.Lines.Sum(l => l.Quantity),
            CashierName = o.CashierName
        }).ToList());
    }

    public async Task<CreateReturnResult> CreateAsync(CreateReturnRequest request, CancellationToken ct = default)
    {
        var userId = _access.UserId;
        var clientRequestId = request.ClientRequestId.Trim();
        var allowNegative = (await storeProfile.GetAsync(ct)).AllowNegativeStock;

        return await transaction.RunAsync(async token =>
        {
            if (await returns.QueryNoTracking().FirstOrDefaultAsync(r => r.ClientRequestId == clientRequestId, token) is { } existing)
                return new CreateReturnResult(await LoadDtoAsync(existing.Id, token), Created: false);

            var shift = await shifts.QueryNoTracking().OpenShiftOfAsync(userId, token)
                ?? throw PosErrors.Create(PosErrors.ChuaMoCa, PosErrors.NoShiftForReturnMessage);

            var order = await orders.Query().Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == request.OrderId, token)
                ?? throw new CodedNotFoundException(PosErrors.KhongThayHoaDon, PosErrors.OrderNotFoundMessage(string.Empty));
            var daysSince = EnsureReturnable(order);

            // Dòng trả: thuộc hóa đơn, cho đổi trả, 1 ≤ SL ≤ còn trả được; tiền hoàn BR-18.
            var lines = new List<(OrderLine Source, ReturnLineInput Input, decimal Refund)>();
            for (var i = 0; i < request.Lines.Count; i++)
            {
                var input = request.Lines[i];
                var source = order.Lines.FirstOrDefault(l => l.Id == input.OrderLineId);
                if (source is null || lines.Any(x => x.Source.Id == input.OrderLineId))
                    throw FieldErrors.Single($"lines[{i}].orderLineId", "Dòng không thuộc hóa đơn");
                if (!source.Returnable)
                    throw PosErrors.Create(PosErrors.HangKhongDoiTra, PosErrors.NotReturnableMessage, $"lines[{i}].orderLineId");
                if (input.Quantity < 1 || input.Quantity > source.ReturnableQty)
                    throw PosErrors.Create(PosErrors.VuotSoLuongTra, PosErrors.MaxReturnMessage(source.ReturnableQty), $"lines[{i}].quantity");

                var refund = OrderPricing.RefundForLine(source.NetAmount, source.RefundedAmount, source.Quantity, source.ReturnedQty, input.Quantity);
                lines.Add((source, input, refund));
            }

            var refundTotal = lines.Sum(l => l.Refund);

            // Xác nhận: quá 7 ngày hoặc hoàn trên 500.000 ₫.
            var reasons = new List<ApprovalReason>();
            if (daysSince > PosRules.FreeReturnDays)
                reasons.Add(new ApprovalReason(ApprovalReasonCode.QuaHanTra, ApprovalText(daysSince)));
            if (refundTotal > PosRules.RefundApprovalThreshold)
                reasons.Add(new ApprovalReason(ApprovalReasonCode.HoanLon, LargeRefundText));

            (Guid Id, string Username)? approver = null;
            if (reasons.Count > 0)
            {
                if (string.IsNullOrWhiteSpace(request.ApprovalToken))
                {
                    throw PosErrors.Create(PosErrors.CanXacNhan, PosErrors.NeedApprovalMessage(reasons.Select(r => r.Text)),
                        extra: new Dictionary<string, object?> { ["approvalReasons"] = reasons });
                }

                approver = approvals.Peek(request.ApprovalToken, ApprovalAction.DoiTra)
                    ?? throw PosErrors.Create(PosErrors.MaXacNhanKhongHopLe, PosErrors.InvalidApprovalMessage);
            }

            if (refundTotal != request.ExpectedRefundTotal)
                throw OrderService.TotalChanged(refundTotal);

            // Hàng đổi: kiểm như thanh toán bước 3–5, 7; không giảm giá, không đổi khách (07 §5 quyết định 13).
            PricedCartResult? exchange = null;
            decimal difference = -refundTotal;
            if (request.Exchange is { } exchangeInput)
            {
                var cartLines = exchangeInput.Lines
                    .Select(l => new CartLineInput { ProductId = l.ProductId, UnitId = l.UnitId, Quantity = l.Quantity })
                    .ToList();
                exchange = await new CartPricer(products).PriceAsync(cartLines, null, token, "exchange.");
                CartPricer.EnsureStock(exchange, allowNegative);
                if (exchange.Cart.Total != exchangeInput.ExpectedTotal)
                    throw OrderService.TotalChanged(exchange.Cart.Total);

                difference = exchange.Cart.Total - refundTotal;
                if (difference > 0)
                {
                    var payment = exchangeInput.Payment
                        ?? throw FieldErrors.Single("exchange.payment", "Chọn phương thức thanh toán phần chênh lệch");
                    if (payment.Method == TenderMethod.TienMat && (payment.CashReceived ?? 0) < difference)
                    {
                        throw PosErrors.Create(PosErrors.TienKhongDu, PosErrors.CashShortMessage(difference - (payment.CashReceived ?? 0)),
                            "exchange.payment.cashReceived");
                    }
                }
            }

            // Ghi phiếu, dòng, hóa đơn gốc, tồn, hóa đơn đổi, điểm khách.
            var now = Now;
            var code = await DocCodes.NextAsync(returns.QueryNoTracking().Select(r => r.Code), CodePrefix, now, 4, token);
            var entity = Return.Create(new ReturnHeader(
                code, now, shift.Id, userId, shift.CashierName, order.Id,
                request.RefundMethod,
                ClientRequestId: clientRequestId,
                Note: request.Note,
                ApprovedById: approver?.Id,
                ApprovedByName: approver?.Username));

            var ledger = new StockLedger(products, units, movements);
            await ledger.LoadAsync(lines.Select(l => l.Source.ProductId).Concat(exchange?.Cart.Lines.Select(l => l.Input.ProductId) ?? []), token);

            foreach (var (source, input, refund) in lines)
            {
                var returnLine = entity.AddLine(source, input.Quantity, input.Condition, input.Reason, input.Note, refund);
                order.RegisterReturn(source.Id, input.Quantity, refund);
                if (input.Condition == ReturnCondition.BanLaiDuoc)
                {
                    var state = ledger.Get(source.ProductId);
                    var newCost = StockMath.NextAvgCost(state.Stock, state.AvgCost, returnLine.BaseQty, source.UnitCost);
                    ledger.Move(source.ProductId, returnLine.BaseQty, MovementType.TraHang, entity.Id, entity.Code, now, newCost);
                }
            }

            if (order.CustomerId is { } customerId
                && await customers.Query().FirstOrDefaultAsync(c => c.Id == customerId, token) is { } customer)
            {
                entity.SetPointsDeducted(customer.DeductPoints(PosRules.PointsFor(refundTotal)));
            }

            Order? exchangeOrder = null;
            if (exchange is not null)
            {
                var cart = exchange.Cart;
                var orderCode = await DocCodes.NextAsync(orders.QueryNoTracking().Select(o => o.Code), OrderService.CodePrefix, now, 4, token);
                var exchangeCustomer = order.CustomerId is { } cid ? await customers.Query().FirstOrDefaultAsync(c => c.Id == cid, token) : null;
                var points = exchangeCustomer is null ? 0 : PosRules.PointsFor(cart.Total);
                exchangeOrder = Order.Create(
                    new OrderHeader(orderCode, now, shift.Id, userId, shift.CashierName,
                        CustomerId: exchangeCustomer?.Id, PointsEarned: points, ExchangeForReturnId: entity.Id,
                        QrContent: request.Exchange!.QrContent),
                    cart);
                var offset = Math.Min(refundTotal, cart.Total);
                if (offset > 0)
                    exchangeOrder.AddPayment(PaymentMethod.BuTruDoiHang, offset);
                if (difference > 0)
                {
                    var payment = request.Exchange.Payment!;
                    var method = (PaymentMethod)(int)payment.Method;
                    exchangeOrder.AddPayment(method, difference, method == PaymentMethod.TienMat ? payment.CashReceived : null, payment.Reference);
                }

                exchangeCustomer?.RecordOrder(points, cart.Total, now);
                foreach (var line in cart.Lines)
                {
                    ledger.Move(line.Input.ProductId, -line.BaseQty, MovementType.BanHang, exchangeOrder.Id, exchangeOrder.Code, now);
                    ledger.MarkUnitUsed(line.Input.UnitId);
                }

                await orders.AddAsync(exchangeOrder, token);
                entity.SetExchange(exchangeOrder.Id, cart.Total);
            }

            await ledger.FlushAsync(token);
            await returns.AddAsync(entity, token);
            await unitOfWork.SaveChangesAsync(token);
            if (approver is not null)
                approvals.Consume(request.ApprovalToken, ApprovalAction.DoiTra);

            return new CreateReturnResult(await LoadDtoAsync(entity.Id, token), Created: true);
        }, ct);
    }

    public async Task<PaginatedResult<ReturnListItem>> GetPagedAsync(ReturnQuery query, CancellationToken ct = default)
    {
        var userId = _access.UserId;
        var source = returns.QueryNoTracking().WithListDetails();

        if (!await _access.CanViewAllAsync(ct))
            source = source.Where(r => r.Shift!.CashierId == userId);
        else if (query.CashierId is { } cashierId)
            source = source.Where(r => r.CashierId == cashierId);

        if (query.ShiftId is { } shiftId)
            source = source.Where(r => r.ShiftId == shiftId);

        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(r => AppDbFunctions.Matches(r.Code, pattern) || AppDbFunctions.Matches(r.Order!.Code, pattern));
        }

        var (from, to) = PosQueries.UtcRange(query.From, query.To);
        if (from is { } f)
            source = source.Where(r => r.CreatedAt >= f);
        if (to is { } t)
            source = source.Where(r => r.CreatedAt < t);

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        return page.Map(items => items.Select(r => r.ToListItem()).ToList());
    }

    public async Task<ReturnDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await returns.QueryNoTracking().WithDetails().FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy phiếu đổi trả");
        if (entity.Shift?.CashierId != _access.UserId && !await _access.CanViewAllAsync(ct))
            throw new ForbiddenException("Bạn chỉ xem được phiếu đổi trả trong ca của mình (cần quyền shifts.view).");
        return entity.ToDto(await _access.CanViewCostAsync(ct));
    }

    /// <summary>BR-17: số ngày lịch từ ngày mua (0) tới hôm nay; &gt; 30 → QuaHanDoiTra; đã trả hết → DaTraHet.</summary>
    private int EnsureReturnable(Order order)
    {
        var daysSince = VietnamDates.Today(timeProvider).DayNumber - VietnamDates.DateOf(order.PaidAt).DayNumber;
        if (daysSince > PosRules.MaxReturnDays)
            throw PosErrors.Create(PosErrors.QuaHanDoiTra, PosErrors.ReturnTooLateMessage);
        if (order.ReturnStatus == OrderReturnStatus.TraHet)
            throw PosErrors.Create(PosErrors.DaTraHet, PosErrors.FullyReturnedMessage(order.Code));
        return daysSince;
    }

    private async Task<ReturnDto> LoadDtoAsync(Guid id, CancellationToken ct) =>
        (await returns.QueryNoTracking().WithDetails().FirstAsync(r => r.Id == id, ct)).ToDto(await _access.CanViewCostAsync(ct));
}
