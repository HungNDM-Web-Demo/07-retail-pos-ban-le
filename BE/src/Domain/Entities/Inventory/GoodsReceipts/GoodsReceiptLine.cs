using Domain.Base;
using Domain.Entities.Inventory.Products;

namespace Domain.Entities.Inventory.GoodsReceipts;

/// <summary>
/// Dòng phiếu nhập (bảng <c>Inventory_GoodsReceiptLines</c>). Dòng của hàng có HSD thuộc phiếu đã nhập kho là một lô (BR-27).
/// </summary>
public class GoodsReceiptLine : BaseEntity, ICreationTracked, IModificationTracked
{
    private GoodsReceiptLine()
    {
    }

    public Guid GoodsReceiptId { get; private set; }
    public GoodsReceipt? GoodsReceipt { get; private set; }
    public int LineNo { get; private set; }
    public Guid ProductId { get; private set; }
    public Product? Product { get; private set; }
    public Guid UnitId { get; private set; }
    public string UnitName { get; private set; } = string.Empty;
    public int Factor { get; private set; } = 1;
    public int Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal Amount { get; private set; }
    public DateOnly? ExpiryDate { get; private set; }
    public decimal? CostBefore { get; private set; }
    public decimal? CostAfter { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public int BaseQty => Quantity * Factor;

    /// <summary>Giá một đơn vị cơ bản, không làm tròn (BR-23).</summary>
    public decimal BaseUnitCost => Factor == 0 ? UnitPrice : UnitPrice / Factor;

    internal static GoodsReceiptLine Create(Guid receiptId, int lineNo, Guid productId, Guid unitId, string unitName, int factor, int quantity, decimal unitPrice, DateOnly? expiryDate, Guid? id) => new()
    {
        Id = id ?? Guid.NewGuid(),
        GoodsReceiptId = receiptId,
        LineNo = lineNo,
        ProductId = productId,
        UnitId = unitId,
        UnitName = unitName,
        Factor = factor,
        Quantity = quantity,
        UnitPrice = unitPrice,
        Amount = unitPrice * quantity,
        ExpiryDate = expiryDate
    };

    public void SetCosts(decimal costBefore, decimal costAfter)
    {
        CostBefore = costBefore;
        CostAfter = costAfter;
    }
}
