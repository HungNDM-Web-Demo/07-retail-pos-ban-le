using Domain.Base;

namespace Domain.Entities.Inventory.Suppliers;

/// <summary>Nhà cung cấp (bảng <c>Inventory_Suppliers</c>, UC-14). Không xóa.</summary>
public class Supplier : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int CodeMaxLength = 20;
    public const int NameMaxLength = 200;
    public const int PhoneMaxLength = 20;
    public const int AddressMaxLength = 300;
    public const int NoteMaxLength = 500;

    private Supplier()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Phone { get; private set; }
    public string? Address { get; private set; }
    public string? Note { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public static Supplier Create(string code, string name, string? phone, string? address, string? note, Guid? id = null)
    {
        var supplier = new Supplier { Id = id ?? Guid.NewGuid(), Code = code };
        supplier.Update(name, phone, address, note);
        return supplier;
    }

    public void Update(string name, string? phone, string? address, string? note)
    {
        Name = name.Trim();
        Phone = TrimToNull(phone);
        Address = TrimToNull(address);
        Note = TrimToNull(note);
    }

    private static string? TrimToNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
