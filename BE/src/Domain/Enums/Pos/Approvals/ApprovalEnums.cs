namespace Domain.Enums.Pos.Approvals;

/// <summary>Loại xác nhận của chủ cửa hàng: giảm giá (UC-05) hoặc đổi trả (UC-07).</summary>
public enum ApprovalAction
{
    GiamGia = 0,
    DoiTra = 1
}

/// <summary>Lý do cần chủ cửa hàng xác nhận (BR-08, BR-09, BR-17, BR-18).</summary>
public enum ApprovalReasonCode
{
    VuotHanMuc = 0,
    DuoiGiaVon = 1,
    QuaHanTra = 2,
    HoanLon = 3
}
