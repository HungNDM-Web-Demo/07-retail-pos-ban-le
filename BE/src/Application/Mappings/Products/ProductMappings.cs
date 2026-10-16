using Application.DTOs.Products;
using Domain.Entities.Inventory.ProductGroups;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Pos;

namespace Application.Mappings.Products;

public static class ProductMappings
{
    public static ProductGroupDto ToDto(this ProductGroup group, int productCount) => new()
    {
        Id = group.Id,
        Code = group.Code,
        Name = group.Name,
        Color = group.Color,
        SortOrder = group.SortOrder,
        IsHidden = group.IsHidden,
        ProductCount = productCount
    };

    public static ProductUnitDto ToDto(this ProductUnit unit) => new()
    {
        Id = unit.Id,
        Name = unit.Name,
        Factor = unit.Factor,
        Barcode = unit.Barcode,
        Price = unit.Price,
        IsBase = unit.IsBase,
        SortOrder = unit.SortOrder,
        EverUsed = unit.EverUsed
    };

    /// <summary>
    /// Mặt hàng kèm đơn vị (cơ bản đứng đầu), tồn quy đổi BR-02, trạng thái BR-26, biên lãi BR-25.
    /// <paramref name="canViewCost"/> = false thì giá vốn, biên lãi là null (07 §1). Cần <c>Include(Group, Units)</c>.
    /// </summary>
    public static ProductDto ToDto(this Product product, bool canViewCost, bool hasDocuments)
    {
        var baseUnit = product.BaseUnit;
        var margin = StockMath.MarginPct(baseUnit.Price, product.AvgCost);
        return new ProductDto
        {
            Id = product.Id,
            Code = product.Code,
            Name = product.Name,
            GroupId = product.GroupId,
            GroupName = product.Group?.Name ?? string.Empty,
            GroupColor = product.Group?.Color ?? string.Empty,
            BaseUnit = baseUnit.Name,
            Barcode = baseUnit.Barcode,
            Price = baseUnit.Price,
            Units = product.Units.OrderBy(u => u.SortOrder).Select(u => u.ToDto()).ToList(),
            AvgCost = canViewCost ? product.AvgCost : null,
            MarginPct = canViewCost ? margin : null,
            IsLowMargin = canViewCost ? StockMath.IsLowMargin(margin) : null,
            Stock = product.Stock,
            StockText = StockMath.StockText(product.Stock, product.UnitFactors()),
            StockStatus = product.StockStatus,
            MinStock = product.MinStock,
            TrackExpiry = product.TrackExpiry,
            Returnable = product.Returnable,
            Status = product.Status,
            ImageUrl = product.ImageUrl,
            Color = product.Color,
            HasDocuments = hasDocuments,
            CreatedAt = product.CreatedAt
        };
    }
}
