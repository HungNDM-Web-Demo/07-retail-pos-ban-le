using Domain.Base;
using Domain.Enums.Pos.Orders;

namespace Domain.Entities.Pos.Orders;

/// <summary>
/// Dòng hóa đơn (bảng <c>Pos_OrderLines</c>): chụp tên, đơn vị, hệ số, giá, giá vốn bình quân lúc thanh toán (BR-13)
/// và phần giảm hóa đơn phân bổ (BR-14).
/// </summary>
public class OrderLine : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int CodeMaxLength = 20;
    public const int ProductNameMaxLength = 200;
    public const int UnitNameMaxLength = 50;
    public const int NoteMaxLength = 200;

    private OrderLine()
    {
    }

    public Guid OrderId { get; private set; }
    public Order? Order { get; private set; }
    public int LineNo { get; private set; }
    public Guid ProductId { get; private set; }
    public Guid UnitId { get; private set; }
    public string ProductCode { get; private set; } = string.Empty;
    public string ProductName { get; private set; } = string.Empty;
    public Guid GroupId { get; private set; }
    public string UnitName { get; private set; } = string.Empty;
    public int Factor { get; private set; } = 1;
    public int Quantity { get; private set; }
    public int BaseQty { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal Amount { get; private set; }
    public DiscountType? DiscountType { get; private set; }
    public decimal? DiscountValue { get; private set; }
    public DiscountReason? DiscountReason { get; private set; }
    public string? DiscountNote { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal AllocatedDiscount { get; private set; }
    public decimal NetAmount { get; private set; }
    public decimal UnitCost { get; private set; }
    public decimal CostAmount { get; private set; }
    public bool Returnable { get; private set; }
    public int ReturnedQty { get; private set; }
    public decimal RefundedAmount { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    /// <summary>Số còn trả được; 0 khi hàng không đổi trả.</summary>
    public int ReturnableQty => Returnable ? Math.Max(0, Quantity - ReturnedQty) : 0;

    internal static OrderLine Create(Guid orderId, PricedLine line)
    {
        var input = line.Input;
        var note = input.Discount?.Note;
        return new OrderLine
        {
            OrderId = orderId,
            LineNo = line.LineNo,
            ProductId = input.ProductId,
            UnitId = input.UnitId,
            ProductCode = input.ProductCode,
            ProductName = input.ProductName,
            GroupId = input.GroupId,
            UnitName = input.UnitName,
            Factor = input.Factor,
            Quantity = input.Quantity,
            BaseQty = line.BaseQty,
            UnitPrice = input.UnitPrice,
            Amount = line.Amount,
            DiscountType = input.Discount?.Type,
            DiscountValue = input.Discount?.Value,
            DiscountReason = input.Discount?.Reason,
            DiscountNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim()[..Math.Min(note.Trim().Length, NoteMaxLength)],
            DiscountAmount = line.DiscountAmount,
            AllocatedDiscount = line.AllocatedDiscount,
            NetAmount = line.NetAmount,
            UnitCost = line.UnitCost,
            CostAmount = line.CostAmount,
            Returnable = input.Returnable
        };
    }

    internal void RegisterReturn(int quantity, decimal refundAmount)
    {
        ReturnedQty += quantity;
        RefundedAmount += refundAmount;
    }
}
