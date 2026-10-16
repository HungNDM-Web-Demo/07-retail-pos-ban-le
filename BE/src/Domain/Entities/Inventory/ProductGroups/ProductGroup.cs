using Domain.Base;

namespace Domain.Entities.Inventory.ProductGroups;

/// <summary>Nhóm hàng (bảng <c>Inventory_ProductGroups</c>, FR-03). Không xóa, chỉ ẩn.</summary>
public class ProductGroup : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int CodeMaxLength = 20;
    public const int NameMaxLength = 100;
    public const int ColorMaxLength = 20;

    private ProductGroup()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Color { get; private set; } = string.Empty;
    public int SortOrder { get; private set; }
    public bool IsHidden { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public static ProductGroup Create(string code, string name, string color, int sortOrder, Guid? id = null) => new()
    {
        Id = id ?? Guid.NewGuid(),
        Code = code.Trim(),
        Name = name.Trim(),
        Color = color.Trim(),
        SortOrder = sortOrder
    };

    public void Update(string name, string color)
    {
        Name = name.Trim();
        Color = color.Trim();
    }

    public void SetHidden(bool isHidden) => IsHidden = isHidden;

    public void SetSortOrder(int sortOrder) => SortOrder = sortOrder;
}
