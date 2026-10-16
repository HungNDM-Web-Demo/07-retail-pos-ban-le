using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.ProductGroups;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.StockAdjustments;
using Domain.Entities.Inventory.Suppliers;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Inventory;

// Bảng Inventory_* (06 §4). Viết trung lập provider: chỉ độ dài, độ chính xác, index; tiền numeric(18,2), ngày thuần DateOnly.

public sealed class ProductGroupConfiguration : IEntityTypeConfiguration<ProductGroup>
{
    public void Configure(EntityTypeBuilder<ProductGroup> builder)
    {
        builder.ToTable("Inventory_ProductGroups");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(ProductGroup.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(ProductGroup.NameMaxLength).IsRequired();
        builder.Property(x => x.Color).HasMaxLength(ProductGroup.ColorMaxLength).IsRequired();
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.Name);
    }
}

public sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Inventory_Products");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(Product.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Product.NameMaxLength).IsRequired();
        builder.Property(x => x.NameSearch).HasMaxLength(Product.NameMaxLength + Product.CodeMaxLength + 1).IsRequired();
        builder.Property(x => x.ImageUrl).HasMaxLength(Product.ImageUrlMaxLength);
        builder.Property(x => x.Color).HasMaxLength(Product.ColorMaxLength).IsRequired();
        builder.Property(x => x.Version).IsConcurrencyToken();
        builder.Money();

        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();
        builder.HasIndex(x => x.GroupId);
        builder.HasIndex(x => x.Status);

        builder.HasOne(x => x.Group).WithMany().HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Units).WithOne(x => x.Product).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(x => x.Units).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class ProductUnitConfiguration : IEntityTypeConfiguration<ProductUnit>
{
    public void Configure(EntityTypeBuilder<ProductUnit> builder)
    {
        builder.ToTable("Inventory_ProductUnits");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Name).HasMaxLength(ProductUnit.NameMaxLength).IsRequired();
        builder.Property(x => x.Barcode).HasMaxLength(ProductUnit.BarcodeMaxLength);
        builder.Money();

        builder.HasIndex(x => new { x.ProductId, x.Name }).IsUnique();

        // Khóa tra cứu của máy quét (BR-03). Unique trên cột cho phép null: Postgres, SQLite bỏ qua null; SQL Server EF tự thêm IS NOT NULL.
        builder.HasIndex(x => x.Barcode).IsUnique();
    }
}

public sealed class SupplierConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> builder)
    {
        builder.ToTable("Inventory_Suppliers");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(Supplier.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Supplier.NameMaxLength).IsRequired();
        builder.Property(x => x.Phone).HasMaxLength(Supplier.PhoneMaxLength);
        builder.Property(x => x.Address).HasMaxLength(Supplier.AddressMaxLength);
        builder.Property(x => x.Note).HasMaxLength(Supplier.NoteMaxLength);
        builder.HasIndex(x => x.Code).IsUnique();
    }
}

public sealed class GoodsReceiptConfiguration : IEntityTypeConfiguration<GoodsReceipt>
{
    public void Configure(EntityTypeBuilder<GoodsReceipt> builder)
    {
        builder.ToTable("Inventory_GoodsReceipts");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(GoodsReceipt.CodeMaxLength).IsRequired();
        builder.Property(x => x.CreatedByName).HasMaxLength(GoodsReceipt.NameMaxLength).IsRequired();
        builder.Property(x => x.Note).HasMaxLength(GoodsReceipt.NoteMaxLength);
        builder.Money();

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => new { x.Status, x.ReceivedDate });

        builder.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Lines).WithOne(x => x.GoodsReceipt).HasForeignKey(x => x.GoodsReceiptId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(x => x.Lines).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class GoodsReceiptLineConfiguration : IEntityTypeConfiguration<GoodsReceiptLine>
{
    public void Configure(EntityTypeBuilder<GoodsReceiptLine> builder)
    {
        builder.ToTable("Inventory_GoodsReceiptLines");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.UnitName).HasMaxLength(ProductUnit.NameMaxLength).IsRequired();
        builder.Money();

        builder.HasIndex(x => new { x.ProductId, x.ExpiryDate });

        builder.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<ProductUnit>().WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class StockAdjustmentConfiguration : IEntityTypeConfiguration<StockAdjustment>
{
    public void Configure(EntityTypeBuilder<StockAdjustment> builder)
    {
        builder.ToTable("Inventory_StockAdjustments");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(StockAdjustment.CodeMaxLength).IsRequired();
        builder.Property(x => x.Note).HasMaxLength(StockAdjustment.NoteMaxLength);
        builder.Property(x => x.CreatedByName).HasMaxLength(StockAdjustment.NameMaxLength).IsRequired();
        builder.Money();

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasOne<GoodsReceiptLine>().WithMany().HasForeignKey(x => x.GoodsReceiptLineId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.StockAdjustmentId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(x => x.Lines).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class StockAdjustmentLineConfiguration : IEntityTypeConfiguration<StockAdjustmentLine>
{
    public void Configure(EntityTypeBuilder<StockAdjustmentLine> builder)
    {
        builder.ToTable("Inventory_StockAdjustmentLines");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Money();
        builder.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class StockMovementConfiguration : IEntityTypeConfiguration<StockMovement>
{
    public void Configure(EntityTypeBuilder<StockMovement> builder)
    {
        builder.ToTable("Inventory_StockMovements");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.DocumentCode).HasMaxLength(StockMovement.DocumentCodeMaxLength).IsRequired();
        builder.Money();

        builder.HasIndex(x => new { x.ProductId, x.OccurredAt });
        builder.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}
