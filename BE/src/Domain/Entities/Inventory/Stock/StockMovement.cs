using Domain.Base;
using Domain.Enums.Inventory.Stock;

namespace Domain.Entities.Inventory.Stock;

/// <summary>
/// Sổ biến động tồn (bảng <c>Inventory_StockMovements</c>, FR-32): chỉ thêm, không sửa, không xóa, không ghi nhật ký thao tác.
/// Số lượng theo đơn vị cơ bản, dương là tăng.
/// </summary>
public class StockMovement : BaseEntity, ICreationTracked, IAuditLogExempt
{
    public const int DocumentCodeMaxLength = 20;
    public const string OpeningDocumentCode = "Tồn đầu kỳ";

    private StockMovement()
    {
    }

    public Guid ProductId { get; private set; }
    public DateTime OccurredAt { get; private set; }
    public MovementType Type { get; private set; }
    public Guid? DocumentId { get; private set; }
    public string DocumentCode { get; private set; } = string.Empty;
    public int Quantity { get; private set; }
    public int StockAfter { get; private set; }
    public decimal CostAfter { get; private set; }

    /// <summary>Thứ tự ghi, để sắp ổn định khi trùng <see cref="OccurredAt"/>.</summary>
    public long Seq { get; private set; }

    public Guid? CreatedBy { get; set; }

    public static StockMovement Create(Guid productId, DateTime occurredAt, MovementType type, Guid? documentId, string documentCode, int quantity, int stockAfter, decimal costAfter, long seq)
    {
        var movement = new StockMovement
        {
            ProductId = productId,
            OccurredAt = occurredAt,
            Type = type,
            DocumentId = documentId,
            DocumentCode = documentCode,
            Quantity = quantity,
            StockAfter = stockAfter,
            CostAfter = costAfter,
            Seq = seq
        };
        movement.CreatedAt = occurredAt;
        return movement;
    }
}
