using Domain.Entities.Crm.Customers;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Returns;
using Domain.Entities.Pos.Shifts;
using Domain.Entities.System.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Pos;

// Bảng Pos_* (06 §4). Hóa đơn, phiếu đổi trả, ca không bao giờ xóa (đặt lại dữ liệu demo xóa cứng bằng ExecuteDelete).

public sealed class ShiftConfiguration : IEntityTypeConfiguration<Shift>
{
    public void Configure(EntityTypeBuilder<Shift> builder)
    {
        builder.ToTable("Pos_Shifts");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(Shift.CodeMaxLength).IsRequired();
        builder.Property(x => x.CashierName).HasMaxLength(Shift.NameMaxLength).IsRequired();
        builder.Property(x => x.Note).HasMaxLength(Shift.NoteMaxLength);
        builder.Property(x => x.ReviewNote).HasMaxLength(Shift.NoteMaxLength);
        builder.Property(x => x.ReviewedByName).HasMaxLength(Shift.NameMaxLength);
        builder.Money();

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => new { x.CashierId, x.Status });
        builder.HasIndex(x => x.OpenedAt);
        builder.HasOne<User>().WithMany().HasForeignKey(x => x.CashierId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Pos_Orders");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(Order.CodeMaxLength).IsRequired();
        builder.Property(x => x.ClientRequestId).HasMaxLength(Order.ClientRequestIdMaxLength);
        builder.Property(x => x.CashierName).HasMaxLength(Order.CashierNameMaxLength).IsRequired();
        builder.Property(x => x.OrderDiscountNote).HasMaxLength(Order.NoteMaxLength);
        builder.Property(x => x.ApprovedByName).HasMaxLength(Order.ApprovedByNameMaxLength);
        builder.Property(x => x.ApprovalReasons).HasMaxLength(Order.ApprovalReasonsMaxLength);
        builder.Property(x => x.Note).HasMaxLength(Order.NoteMaxLength);
        builder.Property(x => x.QrContent).HasMaxLength(Order.QrContentMaxLength);
        builder.Money();

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.ClientRequestId).IsUnique();
        builder.HasIndex(x => x.ExchangeForReturnId).IsUnique();
        builder.HasIndex(x => x.PaidAt);
        builder.HasIndex(x => x.ShiftId);
        builder.HasIndex(x => new { x.CashierId, x.PaidAt });
        builder.HasIndex(x => x.CustomerId);

        builder.HasOne(x => x.Shift).WithMany().HasForeignKey(x => x.ShiftId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(x => x.CashierId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Lines).WithOne(x => x.Order).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(x => x.Payments).WithOne().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(x => x.Returns).WithOne(x => x.Order).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
        builder.Navigation(x => x.Lines).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation(x => x.Payments).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation(x => x.Returns).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class OrderLineConfiguration : IEntityTypeConfiguration<OrderLine>
{
    public void Configure(EntityTypeBuilder<OrderLine> builder)
    {
        builder.ToTable("Pos_OrderLines");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ProductCode).HasMaxLength(OrderLine.CodeMaxLength).IsRequired();
        builder.Property(x => x.ProductName).HasMaxLength(OrderLine.ProductNameMaxLength).IsRequired();
        builder.Property(x => x.UnitName).HasMaxLength(OrderLine.UnitNameMaxLength).IsRequired();
        builder.Property(x => x.DiscountNote).HasMaxLength(OrderLine.NoteMaxLength);
        builder.Money();

        builder.HasIndex(x => x.ProductId);
        builder.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<ProductUnit>().WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class OrderPaymentConfiguration : IEntityTypeConfiguration<OrderPayment>
{
    public void Configure(EntityTypeBuilder<OrderPayment> builder)
    {
        builder.ToTable("Pos_OrderPayments");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Reference).HasMaxLength(OrderPayment.ReferenceMaxLength);
        builder.Money();
    }
}

public sealed class ReturnConfiguration : IEntityTypeConfiguration<Return>
{
    public void Configure(EntityTypeBuilder<Return> builder)
    {
        builder.ToTable("Pos_Returns");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(Return.CodeMaxLength).IsRequired();
        builder.Property(x => x.ClientRequestId).HasMaxLength(Return.ClientRequestIdMaxLength);
        builder.Property(x => x.CashierName).HasMaxLength(Return.NameMaxLength).IsRequired();
        builder.Property(x => x.ApprovedByName).HasMaxLength(Return.ApprovedByNameMaxLength);
        builder.Property(x => x.Note).HasMaxLength(Return.NoteMaxLength);
        builder.Money();

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.ClientRequestId).IsUnique();
        builder.HasIndex(x => x.ShiftId);
        builder.HasIndex(x => x.OrderId);

        builder.HasOne(x => x.Shift).WithMany().HasForeignKey(x => x.ShiftId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(x => x.CashierId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.ExchangeOrder).WithMany().HasForeignKey(x => x.ExchangeOrderId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Lines).WithOne(x => x.Return).HasForeignKey(x => x.ReturnId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(x => x.Lines).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class ReturnLineConfiguration : IEntityTypeConfiguration<ReturnLine>
{
    public void Configure(EntityTypeBuilder<ReturnLine> builder)
    {
        builder.ToTable("Pos_ReturnLines");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Note).HasMaxLength(ReturnLine.NoteMaxLength);
        builder.Money();

        builder.HasIndex(x => x.OrderLineId);
        builder.HasOne(x => x.OrderLine).WithMany().HasForeignKey(x => x.OrderLineId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}
