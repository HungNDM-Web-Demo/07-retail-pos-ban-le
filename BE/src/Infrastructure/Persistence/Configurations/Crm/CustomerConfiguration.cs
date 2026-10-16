using Domain.Entities.Crm.Customers;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Crm;

public sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("Crm_Customers");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Phone).HasMaxLength(Customer.PhoneMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Customer.NameMaxLength).IsRequired();
        builder.Money();
        builder.HasIndex(x => x.Phone).IsUnique().WhereNotDeleted();
    }
}
