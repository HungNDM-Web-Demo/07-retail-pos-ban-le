using Domain.Base;

namespace Domain.Entities.Inventory.Products;

/// <summary>
/// Đơn vị bán của mặt hàng (bảng <c>Inventory_ProductUnits</c>): một đơn vị cơ bản (hệ số 1, <c>SortOrder</c> 0) và tối đa
/// 3 đơn vị quy đổi. Mã vạch là khóa tra cứu của máy quét, unique toàn cục (BR-03).
/// </summary>
public class ProductUnit : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int NameMaxLength = 50;
    public const int BarcodeMaxLength = 14;

    private ProductUnit()
    {
    }

    public Guid ProductId { get; private set; }
    public Product? Product { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public int Factor { get; private set; } = 1;
    public string? Barcode { get; private set; }
    public decimal Price { get; private set; }
    public bool IsBase { get; private set; }
    public int SortOrder { get; private set; }

    /// <summary>Đã có trong hóa đơn, phiếu nhập: không xóa, không đổi hệ số (BR-29).</summary>
    public bool EverUsed { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    internal static ProductUnit Create(Guid productId, string name, int factor, string? barcode, decimal price, bool isBase, int sortOrder, Guid? id, bool everUsed) => new()
    {
        Id = id ?? Guid.NewGuid(),
        ProductId = productId,
        Name = name.Trim(),
        Factor = isBase ? 1 : factor,
        Barcode = string.IsNullOrWhiteSpace(barcode) ? null : barcode.Trim(),
        Price = price,
        IsBase = isBase,
        SortOrder = sortOrder,
        EverUsed = everUsed
    };

    public void Update(string name, int factor, string? barcode, decimal price, int sortOrder)
    {
        Name = name.Trim();
        if (!IsBase)
            Factor = factor;
        Barcode = string.IsNullOrWhiteSpace(barcode) ? null : barcode.Trim();
        Price = price;
        SortOrder = sortOrder;
    }

    public void SetPrice(decimal price) => Price = price;

    public void MarkUsed() => EverUsed = true;
}
