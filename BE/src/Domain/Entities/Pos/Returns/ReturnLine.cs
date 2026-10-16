using Domain.Base;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Pos.Returns;

namespace Domain.Entities.Pos.Returns;

/// <summary>
/// Dòng trả (bảng <c>Pos_ReturnLines</c>). Dòng <see cref="ReturnCondition.HangLoi"/> là sổ hàng lỗi (BR-19), giá trị bằng
/// <see cref="CostAmount"/>.
/// </summary>
public class ReturnLine : BaseEntity, ICreationTracked, IAuditLogExempt
{
    public const int NoteMaxLength = 200;

    private ReturnLine()
    {
    }

    public Guid ReturnId { get; private set; }
    public Return? Return { get; private set; }
    public Guid OrderLineId { get; private set; }
    public OrderLine? OrderLine { get; private set; }
    public Guid ProductId { get; private set; }
    public int Quantity { get; private set; }
    public int BaseQty { get; private set; }
    public ReturnCondition Condition { get; private set; }
    public ReturnReason Reason { get; private set; }
    public string? Note { get; private set; }
    public decimal RefundAmount { get; private set; }
    public decimal UnitCost { get; private set; }
    public decimal CostAmount { get; private set; }

    public Guid? CreatedBy { get; set; }

    internal static ReturnLine Create(Guid returnId, OrderLine source, int quantity, ReturnCondition condition, ReturnReason reason, string? note, decimal refundAmount)
    {
        var trimmed = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        var baseQty = quantity * source.Factor;
        return new ReturnLine
        {
            ReturnId = returnId,
            OrderLineId = source.Id,
            ProductId = source.ProductId,
            Quantity = quantity,
            BaseQty = baseQty,
            Condition = condition,
            Reason = reason,
            Note = trimmed is null ? null : trimmed[..Math.Min(trimmed.Length, NoteMaxLength)],
            RefundAmount = refundAmount,
            UnitCost = source.UnitCost,
            CostAmount = baseQty * source.UnitCost
        };
    }
}
