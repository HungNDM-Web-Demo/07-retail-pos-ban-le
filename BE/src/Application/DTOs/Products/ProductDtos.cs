using Application.Common.Models;
using Domain.Enums.Inventory.Products;
using Domain.Enums.Inventory.Stock;

namespace Application.DTOs.Products;

// Hợp đồng 07 §2.1, §2.2 (FE src/types/retail-pos.ts).

public sealed record ProductGroupDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsHidden { get; init; }

    /// <summary>Mọi mặt hàng của nhóm, kể cả ngừng bán.</summary>
    public int ProductCount { get; init; }
}

public sealed record SaveProductGroupRequest
{
    public string Name { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
}

public sealed record ProductGroupVisibilityRequest
{
    public bool IsHidden { get; init; }
}

public sealed record ReorderProductGroupsRequest
{
    public IReadOnlyList<Guid> Ids { get; init; } = [];
}

public sealed record ProductUnitDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int Factor { get; init; }
    public string? Barcode { get; init; }
    public decimal Price { get; init; }
    public bool IsBase { get; init; }
    public int SortOrder { get; init; }
    public bool EverUsed { get; init; }
}

public sealed record ProductDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public Guid GroupId { get; init; }
    public string GroupName { get; init; } = string.Empty;
    public string GroupColor { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public string? Barcode { get; init; }
    public decimal Price { get; init; }
    public IReadOnlyList<ProductUnitDto> Units { get; init; } = [];

    /// <summary>null khi người gọi thiếu products.view-cost.</summary>
    public decimal? AvgCost { get; init; }

    public decimal? MarginPct { get; init; }
    public bool? IsLowMargin { get; init; }
    public int Stock { get; init; }
    public string StockText { get; init; } = string.Empty;
    public StockStatus StockStatus { get; init; }
    public int MinStock { get; init; }
    public bool TrackExpiry { get; init; }
    public bool Returnable { get; init; }
    public ProductStatus Status { get; init; }
    public string? ImageUrl { get; init; }
    public string Color { get; init; } = string.Empty;
    public bool HasDocuments { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class ProductQuery : PaginationQuery
{
    public Guid? GroupId { get; set; }
    public ProductStatus? Status { get; set; }
    public StockStatus? StockStatus { get; set; }
    public bool? LowMargin { get; set; }
}

public sealed record SaveProductUnitInput
{
    public Guid? Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int Factor { get; init; }
    public string? Barcode { get; init; }
    public decimal Price { get; init; }
}

public sealed record SaveProductRequest
{
    public string Name { get; init; } = string.Empty;
    public Guid GroupId { get; init; }
    public string BaseUnit { get; init; } = string.Empty;
    public string? Barcode { get; init; }
    public decimal Price { get; init; }

    /// <summary>Chỉ dùng khi tạo (giá vốn ban đầu); sửa thì bỏ qua.</summary>
    public decimal? InitialCost { get; init; }

    public int MinStock { get; init; }
    public bool TrackExpiry { get; init; }
    public bool Returnable { get; init; } = true;
    public ProductStatus Status { get; init; }
    public string? ImageUrl { get; init; }

    /// <summary>Vắng thì lấy màu nhóm.</summary>
    public string? Color { get; init; }

    /// <summary>Tối đa 3, không gồm đơn vị cơ bản.</summary>
    public IReadOnlyList<SaveProductUnitInput> Units { get; init; } = [];
}

public sealed record ProductStatusRequest
{
    public ProductStatus Status { get; init; }
}

public sealed record UnitPriceInput
{
    public Guid UnitId { get; init; }
    public decimal Price { get; init; }
}

public sealed record UpdateProductPricesRequest
{
    public IReadOnlyList<UnitPriceInput> Prices { get; init; } = [];
}

public sealed record InternalBarcodeDto
{
    public string Barcode { get; init; } = string.Empty;
}

public sealed record ProductLookupDto
{
    public ProductDto Product { get; init; } = new();
    public Guid UnitId { get; init; }
}

// Danh mục cho máy bán hàng (07 §2.3), không có giá vốn.

public sealed record PosCatalogUnit
{
    public Guid UnitId { get; init; }
    public string Name { get; init; } = string.Empty;
    public int Factor { get; init; }
    public string? Barcode { get; init; }
    public decimal Price { get; init; }
}

public sealed record PosCatalogItem
{
    public Guid ProductId { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string SearchText { get; init; } = string.Empty;
    public Guid GroupId { get; init; }
    public string BaseUnit { get; init; } = string.Empty;
    public IReadOnlyList<PosCatalogUnit> Units { get; init; } = [];
    public int Stock { get; init; }
    public int MinStock { get; init; }
    public ProductStatus Status { get; init; }
    public bool Returnable { get; init; }
    public string? ImageUrl { get; init; }
    public string Color { get; init; } = string.Empty;
}

public sealed record PosCatalogGroup
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsHidden { get; init; }
}

public sealed record PosCatalog
{
    public string Version { get; init; } = string.Empty;
    public DateTime GeneratedAt { get; init; }
    public IReadOnlyList<PosCatalogGroup> Groups { get; init; } = [];
    public IReadOnlyList<PosCatalogItem> Items { get; init; } = [];
}
