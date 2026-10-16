namespace Domain.Enums.Inventory.Products;

/// <summary>Trạng thái mặt hàng (06 §4 <c>Inventory_Products.Status</c>).</summary>
public enum ProductStatus
{
    /// <summary>Đang bán.</summary>
    DangBan = 0,

    /// <summary>Ngừng bán: quét mã báo "Hàng ngừng bán" (TC-04).</summary>
    NgungBan = 1
}
