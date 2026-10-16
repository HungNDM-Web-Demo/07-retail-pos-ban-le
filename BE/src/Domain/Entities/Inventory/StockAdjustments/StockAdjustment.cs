using Domain.Base;
using Domain.Entities.Inventory.Products;
using Domain.Enums.Inventory.StockAdjustments;

namespace Domain.Entities.Inventory.StockAdjustments;

/// <summary>
/// Phiếu điều chỉnh tồn (bảng <c>Inventory_StockAdjustments</c>, UC-13). Lưu là áp dụng ngay, không sửa, không xóa,
/// không đổi giá vốn (BR-28).
/// </summary>
public class StockAdjustment : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int CodeMaxLength = 20;
    public const int NoteMaxLength = 500;
    public const int NameMaxLength = 150;

    private readonly List<StockAdjustmentLine> _lines = [];

    private StockAdjustment()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public AdjustmentReason Reason { get; private set; }
    public string? Note { get; private set; }
    public Guid? GoodsReceiptLineId { get; private set; }
    public string CreatedByName { get; private set; } = string.Empty;
    public decimal TotalValue { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public IReadOnlyCollection<StockAdjustmentLine> Lines => _lines;

    public static StockAdjustment Create(string code, AdjustmentReason reason, string? note, Guid? goodsReceiptLineId, string createdByName, DateTime? createdAt = null, Guid? id = null)
    {
        var adjustment = new StockAdjustment
        {
            Id = id ?? Guid.NewGuid(),
            Code = code,
            Reason = reason,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            GoodsReceiptLineId = goodsReceiptLineId,
            CreatedByName = createdByName
        };
        if (createdAt is { } at)
            adjustment.CreatedAt = at;
        return adjustment;
    }

    /// <summary>BR-28: chênh lệch = thực tế − hệ thống; giá trị = chênh lệch × giá vốn bình quân lúc lưu.</summary>
    public StockAdjustmentLine AddLine(Guid productId, int systemQty, int actualQty, decimal unitCost)
    {
        var line = StockAdjustmentLine.Create(Id, productId, systemQty, actualQty, unitCost);
        _lines.Add(line);
        TotalValue = _lines.Sum(l => l.Value);
        return line;
    }
}

/// <summary>Dòng điều chỉnh (bảng <c>Inventory_StockAdjustmentLines</c>).</summary>
public class StockAdjustmentLine : BaseEntity, ICreationTracked, IModificationTracked
{
    private StockAdjustmentLine()
    {
    }

    public Guid StockAdjustmentId { get; private set; }
    public Guid ProductId { get; private set; }
    public Product? Product { get; private set; }
    public int SystemQty { get; private set; }
    public int ActualQty { get; private set; }
    public int Difference { get; private set; }
    public decimal UnitCost { get; private set; }
    public decimal Value { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    internal static StockAdjustmentLine Create(Guid adjustmentId, Guid productId, int systemQty, int actualQty, decimal unitCost) => new()
    {
        StockAdjustmentId = adjustmentId,
        ProductId = productId,
        SystemQty = systemQty,
        ActualQty = actualQty,
        Difference = actualQty - systemQty,
        UnitCost = unitCost,
        Value = (actualQty - systemQty) * unitCost
    };
}
