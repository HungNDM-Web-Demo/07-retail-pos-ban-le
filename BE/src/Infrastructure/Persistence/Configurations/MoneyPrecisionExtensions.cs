using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

/// <summary>Tiền <c>numeric(18,2)</c> (06 §3) cho mọi cột decimal của entity, khỏi khai báo từng cột.</summary>
internal static class MoneyPrecisionExtensions
{
    public static EntityTypeBuilder<T> Money<T>(this EntityTypeBuilder<T> builder)
        where T : class
    {
        foreach (var property in builder.Metadata.GetDeclaredProperties()
                     .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
        {
            builder.Property(property.Name).HasPrecision(18, 2);
        }

        return builder;
    }
}
