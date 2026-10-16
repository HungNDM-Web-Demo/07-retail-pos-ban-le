namespace Domain.Enums.Pos.Orders;

/// <summary>Kiểu giảm giá dòng, hóa đơn.</summary>
public enum DiscountType
{
    PhanTram = 0,
    SoTien = 1
}

/// <summary>Lý do giảm giá.</summary>
public enum DiscountReason
{
    KhachQuen = 0,
    HangMopMeo = 1,
    CanHanSuDung = 2,
    Khac = 3
}

/// <summary>Phương thức trên khoản thu; <see cref="BuTruDoiHang"/> chỉ do hệ thống ghi khi đổi hàng (BR-20).</summary>
public enum PaymentMethod
{
    TienMat = 0,
    ChuyenKhoan = 1,
    The = 2,
    BuTruDoiHang = 3
}

/// <summary>Phương thức thu ngân chọn trong hộp thanh toán (07 §5 quyết định 10).</summary>
public enum TenderMethod
{
    TienMat = 0,
    ChuyenKhoan = 1,
    The = 2
}

/// <summary>Trạng thái trả hàng của hóa đơn, cập nhật khi lập phiếu đổi trả.</summary>
public enum OrderReturnStatus
{
    ChuaTra = 0,
    TraMotPhan = 1,
    TraHet = 2
}
