using Domain.Base;

namespace Domain.Entities.Crm.Customers;

/// <summary>
/// Khách thân thiết (bảng <c>Crm_Customers</c>, P3). Điểm cộng khi thanh toán, trừ khi trả hàng (BR-31), không âm.
/// Cập nhật theo mỗi hóa đơn nên không ghi nhật ký thao tác.
/// </summary>
public class Customer : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete, IAuditLogExempt
{
    public const int PhoneMaxLength = 20;
    public const int NameMaxLength = 150;

    private Customer()
    {
    }

    public string Phone { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public int Points { get; private set; }
    public int OrderCount { get; private set; }
    public decimal TotalSpent { get; private set; }
    public DateTime? LastOrderAt { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public static Customer Create(string phone, string name, DateTime? createdAt = null, Guid? id = null)
    {
        var customer = new Customer { Id = id ?? Guid.NewGuid(), Phone = phone.Trim(), Name = name.Trim() };
        if (createdAt is { } at)
            customer.CreatedAt = at;
        return customer;
    }

    /// <summary>Cộng điểm, số đơn, tổng chi tiêu khi thanh toán.</summary>
    public void RecordOrder(int points, decimal total, DateTime paidAt)
    {
        Points += points;
        OrderCount++;
        TotalSpent += total;
        if (LastOrderAt is null || paidAt > LastOrderAt)
            LastOrderAt = paidAt;
    }

    /// <summary>Trừ điểm khi trả hàng; điểm không âm. Trả về số điểm thực trừ.</summary>
    public int DeductPoints(int points)
    {
        var deducted = Math.Min(Points, Math.Max(0, points));
        Points -= deducted;
        return deducted;
    }
}
