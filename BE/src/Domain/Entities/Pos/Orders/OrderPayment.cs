using Domain.Base;
using Domain.Enums.Pos.Orders;

namespace Domain.Entities.Pos.Orders;

/// <summary>
/// Khoản thu của hóa đơn (bảng <c>Pos_OrderPayments</c>): thường một dòng; hóa đơn đổi hàng có dòng <c>BuTruDoiHang</c>
/// cộng (nếu còn phải thu) một dòng phương thức khách trả thêm. Σ <see cref="Amount"/> = tổng hóa đơn.
/// </summary>
public class OrderPayment : BaseEntity, ICreationTracked, IAuditLogExempt
{
    public const int ReferenceMaxLength = 100;

    private OrderPayment()
    {
    }

    public Guid OrderId { get; private set; }
    public PaymentMethod Method { get; private set; }
    public decimal Amount { get; private set; }
    public decimal? CashReceived { get; private set; }
    public decimal? ChangeAmount { get; private set; }
    public string? Reference { get; private set; }

    public Guid? CreatedBy { get; set; }

    internal static OrderPayment Create(Guid orderId, PaymentMethod method, decimal amount, decimal? cashReceived, string? reference)
    {
        var isCash = method == PaymentMethod.TienMat;
        var received = isCash ? cashReceived ?? amount : (decimal?)null;
        var trimmed = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim();
        return new OrderPayment
        {
            OrderId = orderId,
            Method = method,
            Amount = amount,
            CashReceived = received,
            ChangeAmount = isCash ? received - amount : null,
            Reference = trimmed is null ? null : trimmed[..Math.Min(trimmed.Length, ReferenceMaxLength)]
        };
    }
}
