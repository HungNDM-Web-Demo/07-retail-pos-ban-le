namespace Domain.Enums.Pos.Returns;

/// <summary>Hình thức trả phần tiền hoàn còn lại cho khách.</summary>
public enum RefundMethod
{
    TienMat = 0,
    ChuyenKhoan = 1
}

/// <summary>Tình trạng hàng trả (BR-19).</summary>
public enum ReturnCondition
{
    BanLaiDuoc = 0,
    HangLoi = 1
}

/// <summary>Lý do trả hàng.</summary>
public enum ReturnReason
{
    KhachDoiY = 0,
    MuaNham = 1,
    LoiNhaSanXuat = 2,
    HetHan = 3,
    Khac = 4
}
