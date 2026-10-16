using Domain.Base;
using Domain.Entities.Inventory.Suppliers;
using Domain.Enums.Inventory.GoodsReceipts;

namespace Domain.Entities.Inventory.GoodsReceipts;

/// <summary>
/// Phiếu nhập (bảng <c>Inventory_GoodsReceipts</c>, UC-14). Nháp thì sửa, xóa được; đã nhập kho thì chỉ xem (BR-24).
/// </summary>
public class GoodsReceipt : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int CodeMaxLength = 20;
    public const int NameMaxLength = 150;
    public const int NoteMaxLength = 500;

    private readonly List<GoodsReceiptLine> _lines = [];

    private GoodsReceipt()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public Guid SupplierId { get; private set; }
    public Supplier? Supplier { get; private set; }
    public GoodsReceiptStatus Status { get; private set; }
    public DateOnly ReceivedDate { get; private set; }
    public DateTime? ConfirmedAt { get; private set; }
    public Guid? ConfirmedById { get; private set; }
    public string CreatedByName { get; private set; } = string.Empty;
    public string? Note { get; private set; }
    public decimal TotalAmount { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public IReadOnlyCollection<GoodsReceiptLine> Lines => _lines;

    public bool IsConfirmed => Status == GoodsReceiptStatus.DaNhapKho;

    public static GoodsReceipt Create(string code, Guid supplierId, DateOnly receivedDate, string? note, string createdByName, DateTime? createdAt = null, Guid? id = null)
    {
        var receipt = new GoodsReceipt
        {
            Id = id ?? Guid.NewGuid(),
            Code = code,
            CreatedByName = createdByName,
            Status = GoodsReceiptStatus.Nhap
        };
        if (createdAt is { } at)
            receipt.CreatedAt = at;
        receipt.UpdateHeader(supplierId, receivedDate, note);
        return receipt;
    }

    public void UpdateHeader(Guid supplierId, DateOnly receivedDate, string? note)
    {
        SupplierId = supplierId;
        ReceivedDate = receivedDate;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }

    public GoodsReceiptLine AddLine(Guid productId, Guid unitId, string unitName, int factor, int quantity, decimal unitPrice, DateOnly? expiryDate, Guid? id = null)
    {
        var line = GoodsReceiptLine.Create(Id, _lines.Count + 1, productId, unitId, unitName, factor, quantity, unitPrice, expiryDate, id);
        _lines.Add(line);
        TotalAmount = _lines.Sum(l => l.Amount);
        return line;
    }

    public void ClearLines()
    {
        _lines.Clear();
        TotalAmount = 0;
    }

    /// <summary>Xác nhận nhập kho; giá vốn từng dòng do người gọi tính theo BR-23 rồi ghi bằng <see cref="GoodsReceiptLine.SetCosts"/>.</summary>
    public void Confirm(Guid? confirmedById, DateTime confirmedAt)
    {
        Status = GoodsReceiptStatus.DaNhapKho;
        ConfirmedById = confirmedById;
        ConfirmedAt = confirmedAt;
    }
}
