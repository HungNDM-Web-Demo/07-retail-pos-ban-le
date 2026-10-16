using Domain.Base;
using Domain.Common;
using Domain.Entities.Inventory.ProductGroups;
using Domain.Entities.Pos;
using Domain.Enums.Inventory.Products;
using Domain.Enums.Inventory.Stock;

namespace Domain.Entities.Inventory.Products;

/// <summary>
/// Mặt hàng (bảng <c>Inventory_Products</c>, UC-01). Tồn và giá vốn bình quân theo đơn vị cơ bản; <see cref="Version"/> là
/// concurrency token, tăng mỗi lần đổi tồn hoặc giá vốn (06 §3). Xóa mềm khi chưa có chứng từ (BR-29).
/// </summary>
public class Product : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int CodeMaxLength = 20;
    public const int NameMaxLength = 200;
    public const int ImageUrlMaxLength = 500;
    public const int ColorMaxLength = 20;

    private readonly List<ProductUnit> _units = [];

    private Product()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string NameSearch { get; private set; } = string.Empty;
    public Guid GroupId { get; private set; }
    public ProductGroup? Group { get; private set; }
    public int Stock { get; private set; }
    public decimal AvgCost { get; private set; }
    public int MinStock { get; private set; }
    public bool TrackExpiry { get; private set; }
    public bool Returnable { get; private set; } = true;
    public ProductStatus Status { get; private set; }
    public string? ImageUrl { get; private set; }
    public string Color { get; private set; } = string.Empty;
    public int OpeningStock { get; private set; }
    public int Version { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public IReadOnlyCollection<ProductUnit> Units => _units;

    public ProductUnit BaseUnit => _units.First(u => u.IsBase);

    public bool IsActive => Status == ProductStatus.DangBan;

    public StockStatus StockStatus => StockMath.StatusOf(Stock, MinStock);

    public static Product Create(
        string code,
        string name,
        Guid groupId,
        int minStock,
        bool trackExpiry,
        bool returnable,
        ProductStatus status,
        string? imageUrl,
        string color,
        decimal avgCost,
        int stock = 0,
        int openingStock = 0,
        Guid? id = null)
    {
        if (avgCost < 0)
            throw new DomainException("Giá vốn không âm");

        var product = new Product
        {
            Id = id ?? Guid.NewGuid(),
            Code = code,
            GroupId = groupId,
            AvgCost = avgCost,
            Stock = stock,
            OpeningStock = openingStock
        };
        product.Update(name, groupId, minStock, trackExpiry, returnable, status, imageUrl, color);
        return product;
    }

    public void Update(string name, Guid groupId, int minStock, bool trackExpiry, bool returnable, ProductStatus status, string? imageUrl, string color)
    {
        Name = name.Trim();
        NameSearch = VietnameseText.Normalize(Name + " " + Code);
        GroupId = groupId;
        MinStock = Math.Max(0, minStock);
        TrackExpiry = trackExpiry;
        Returnable = returnable;
        Status = status;
        ImageUrl = string.IsNullOrWhiteSpace(imageUrl) ? null : imageUrl.Trim();
        Color = color.Trim();
    }

    public void SetStatus(ProductStatus status) => Status = status;

    public ProductUnit AddUnit(string name, int factor, string? barcode, decimal price, bool isBase, int sortOrder, Guid? id = null, bool everUsed = false)
    {
        var unit = ProductUnit.Create(Id, name, factor, barcode, price, isBase, sortOrder, id, everUsed);
        _units.Add(unit);
        return unit;
    }

    public void RemoveUnit(ProductUnit unit) => _units.Remove(unit);

    /// <summary>Đơn vị theo hệ số (đọc tồn quy đổi BR-02).</summary>
    public IEnumerable<UnitFactor> UnitFactors() => _units.Select(u => new UnitFactor(u.Name, u.Factor));

    /// <summary>Tồn sau khi chạy lại lịch sử dữ liệu mẫu (06 §5.4), không tăng Version.</summary>
    public void SeedStock(int stock) => Stock = stock;

    /// <summary>Đặt tồn và giá vốn mới (chứng từ trong bộ nhớ, dữ liệu mẫu). Lưu thật đi qua cập nhật có điều kiện <see cref="Version"/>.</summary>
    public void ApplyStock(int stock, decimal avgCost)
    {
        Stock = stock;
        AvgCost = avgCost;
        Version++;
    }
}
