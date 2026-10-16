using Domain.Base;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Pos.Returns;
using Domain.Entities.Pos.Shifts;
using Domain.Enums.Pos.Orders;

namespace Domain.Entities.Pos.Orders;

/// <summary>Thông tin đầu hóa đơn lúc thanh toán (ngoài phần tiền đã tính trong <see cref="PricedCart"/>).</summary>
public sealed record OrderHeader(
    string Code,
    DateTime PaidAt,
    Guid ShiftId,
    Guid CashierId,
    string CashierName,
    string? ClientRequestId = null,
    Guid? CustomerId = null,
    int PointsEarned = 0,
    Guid? ApprovedById = null,
    string? ApprovedByName = null,
    string? ApprovalReasons = null,
    string? Note = null,
    string? QrContent = null,
    Guid? ExchangeForReturnId = null,
    Guid? Id = null);

/// <summary>
/// Hóa đơn đã thanh toán (bảng <c>Pos_Orders</c>, UC-06), gồm hóa đơn đổi hàng (BR-20). Không xóa, không sửa (BR-15);
/// chỉ cập nhật số đã trả khi lập phiếu đổi trả. Không ghi nhật ký thao tác (06 §3).
/// </summary>
public class Order : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int CodeMaxLength = 20;
    public const int ClientRequestIdMaxLength = 64;
    public const int CashierNameMaxLength = 150;
    public const int ApprovedByNameMaxLength = 50;
    public const int ApprovalReasonsMaxLength = 300;
    public const int NoteMaxLength = 200;
    public const int QrContentMaxLength = 300;

    private readonly List<OrderLine> _lines = [];
    private readonly List<OrderPayment> _payments = [];
    private readonly List<Return> _returns = [];

    private Order()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string? ClientRequestId { get; private set; }
    public DateTime PaidAt { get; private set; }
    public Guid ShiftId { get; private set; }
    public Shift? Shift { get; private set; }
    public Guid CashierId { get; private set; }
    public string CashierName { get; private set; } = string.Empty;
    public decimal Subtotal { get; private set; }
    public decimal LineDiscountTotal { get; private set; }
    public DiscountType? OrderDiscountType { get; private set; }
    public decimal? OrderDiscountValue { get; private set; }
    public decimal OrderDiscountAmount { get; private set; }
    public DiscountReason? OrderDiscountReason { get; private set; }
    public string? OrderDiscountNote { get; private set; }
    public decimal Total { get; private set; }
    public decimal CostTotal { get; private set; }
    public Guid? ApprovedById { get; private set; }
    public string? ApprovedByName { get; private set; }
    public string? ApprovalReasons { get; private set; }
    public Guid? CustomerId { get; private set; }
    public Customer? Customer { get; private set; }
    public int PointsEarned { get; private set; }
    public OrderReturnStatus ReturnStatus { get; private set; }
    public Guid? ExchangeForReturnId { get; private set; }
    public string? Note { get; private set; }
    public string? QrContent { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public IReadOnlyCollection<OrderLine> Lines => _lines;
    public IReadOnlyCollection<OrderPayment> Payments => _payments;

    /// <summary>Phiếu đổi trả lập trên hóa đơn này (hóa đơn gốc).</summary>
    public IReadOnlyCollection<Return> Returns => _returns;

    public decimal DiscountTotal => LineDiscountTotal + OrderDiscountAmount;

    public bool IsExchange => ExchangeForReturnId.HasValue;

    /// <summary>Tạo hóa đơn từ giỏ đã tính tiền: chụp giá, giá vốn, tên lúc bán (BR-13).</summary>
    public static Order Create(OrderHeader header, PricedCart cart)
    {
        var order = new Order
        {
            Id = header.Id ?? Guid.NewGuid(),
            Code = header.Code,
            ClientRequestId = header.ClientRequestId,
            PaidAt = header.PaidAt,
            ShiftId = header.ShiftId,
            CashierId = header.CashierId,
            CashierName = header.CashierName,
            Subtotal = cart.Subtotal,
            LineDiscountTotal = cart.LineDiscountTotal,
            OrderDiscountType = cart.OrderDiscount?.Type,
            OrderDiscountValue = cart.OrderDiscount?.Value,
            OrderDiscountAmount = cart.OrderDiscountAmount,
            OrderDiscountReason = cart.OrderDiscount?.Reason,
            OrderDiscountNote = Trim(cart.OrderDiscount?.Note, NoteMaxLength),
            Total = cart.Total,
            CostTotal = cart.CostTotal,
            ApprovedById = header.ApprovedById,
            ApprovedByName = header.ApprovedByName,
            ApprovalReasons = Trim(header.ApprovalReasons, ApprovalReasonsMaxLength),
            CustomerId = header.CustomerId,
            PointsEarned = header.PointsEarned,
            ReturnStatus = OrderReturnStatus.ChuaTra,
            ExchangeForReturnId = header.ExchangeForReturnId,
            Note = Trim(header.Note, NoteMaxLength),
            QrContent = Trim(header.QrContent, QrContentMaxLength)
        };
        order.CreatedAt = header.PaidAt;

        foreach (var line in cart.Lines)
            order._lines.Add(OrderLine.Create(order.Id, line));

        return order;
    }

    /// <summary>Thêm khoản thu; tiền mặt ghi <c>Amount</c> = số phải thu, kèm tiền khách đưa và tiền thối (07 §5 quyết định 11).</summary>
    public OrderPayment AddPayment(PaymentMethod method, decimal amount, decimal? cashReceived = null, string? reference = null)
    {
        var payment = OrderPayment.Create(Id, method, amount, cashReceived, reference);
        _payments.Add(payment);
        return payment;
    }

    /// <summary>Đánh dấu là hóa đơn đổi hàng của phiếu đổi trả (BR-20); dữ liệu mẫu gán sau khi dựng phiếu.</summary>
    public void SetExchangeFor(Guid returnId) => ExchangeForReturnId = returnId;

    /// <summary>Gán lại mã khi trùng do hai quầy thanh toán cùng lúc.</summary>
    public void ReassignCode(string code) => Code = code;

    /// <summary>Ghi số đã trả của một dòng (phiếu đổi trả) rồi tính lại trạng thái trả hàng.</summary>
    public void RegisterReturn(Guid orderLineId, int quantity, decimal refundAmount)
    {
        var line = _lines.First(l => l.Id == orderLineId);
        line.RegisterReturn(quantity, refundAmount);
        ReturnStatus = _lines.All(l => l.ReturnedQty >= l.Quantity)
            ? OrderReturnStatus.TraHet
            : _lines.Any(l => l.ReturnedQty > 0) ? OrderReturnStatus.TraMotPhan : OrderReturnStatus.ChuaTra;
    }

    private static string? Trim(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var trimmed = value.Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }
}
