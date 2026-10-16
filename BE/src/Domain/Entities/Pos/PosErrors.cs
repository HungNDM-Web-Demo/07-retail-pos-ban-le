using Domain.Common;

namespace Domain.Entities.Pos;

/// <summary>
/// Mã lỗi nghiệp vụ trả trong <c>ProblemDetails.code</c> (07 §2.12) và câu đúng chữ. Lỗi 400 tạo bằng <see cref="Create"/>;
/// 404, 403, 409 do tầng Application ném kèm cùng mã.
/// </summary>
public static class PosErrors
{
    public const string ChuaMoCa = nameof(ChuaMoCa);
    public const string CaDaMo = nameof(CaDaMo);
    public const string GioTrong = nameof(GioTrong);
    public const string HangNgungBan = nameof(HangNgungBan);
    public const string DonViKhongHopLe = nameof(DonViKhongHopLe);
    public const string SoLuongKhongHopLe = nameof(SoLuongKhongHopLe);
    public const string VuotTon = nameof(VuotTon);
    public const string GiamQuaTongTien = nameof(GiamQuaTongTien);
    public const string CanXacNhan = nameof(CanXacNhan);
    public const string MaXacNhanKhongHopLe = nameof(MaXacNhanKhongHopLe);
    public const string TienKhongDu = nameof(TienKhongDu);
    public const string TongTienDaDoi = nameof(TongTienDaDoi);
    public const string KhongThayHoaDon = nameof(KhongThayHoaDon);
    public const string QuaHanDoiTra = nameof(QuaHanDoiTra);
    public const string DaTraHet = nameof(DaTraHet);
    public const string HangKhongDoiTra = nameof(HangKhongDoiTra);
    public const string VuotSoLuongTra = nameof(VuotSoLuongTra);
    public const string MaVachDaDung = nameof(MaVachDaDung);
    public const string GiaKhongHopLe = nameof(GiaKhongHopLe);
    public const string DonViQuyDoiKhongHopLe = nameof(DonViQuyDoiKhongHopLe);
    public const string HangDaCoChungTu = nameof(HangDaCoChungTu);
    public const string DonViDaDung = nameof(DonViDaDung);
    public const string PhieuDaNhapKho = nameof(PhieuDaNhapKho);
    public const string ThieuHanSuDung = nameof(ThieuHanSuDung);
    public const string CaKhongCanKiemTra = nameof(CaKhongCanKiemTra);
    public const string CanGhiChu = nameof(CanGhiChu);
    public const string SaiTaiKhoanXacNhan = nameof(SaiTaiKhoanXacNhan);
    public const string KhongCoQuyenXacNhan = nameof(KhongCoQuyenXacNhan);

    public const string NoShiftForSaleMessage = "Chưa mở ca, mở ca trước khi bán hàng";
    public const string NoShiftForReturnMessage = "Mở ca trước khi đổi trả";
    public const string NoShiftMessage = "Chưa mở ca";
    public const string EmptyCartMessage = "Hóa đơn chưa có hàng";
    public const string InvalidUnitMessage = "Đơn vị không còn bán, tải lại danh mục";
    public const string InvalidQuantityMessage = "Số lượng từ 1 đến 9.999";
    public const string DiscountTooLargeMessage = "Số tiền giảm lớn hơn tổng tiền hàng";
    public const string InvalidApprovalMessage = "Xác nhận của chủ cửa hàng không hợp lệ hoặc đã hết hạn, xác nhận lại";
    public const string TotalChangedMessage = "Tổng tiền đã thay đổi (giá hoặc giảm giá), kiểm tra lại hóa đơn";
    public const string ReturnTooLateMessage = "Hóa đơn đã quá 30 ngày, không nhận đổi trả";
    public const string NotReturnableMessage = "Hàng không đổi trả";
    public const string InvalidPriceMessage = "Giá phải là bội số của 500 ₫";
    public const string InvalidFactorMessage = "Hệ số là số nguyên từ 2 đến 1.000";
    public const string TooManyUnitsMessage = "Tối đa 3 đơn vị quy đổi";
    public const string ProductHasDocumentsMessage = "Mặt hàng đã có chứng từ, không xóa được. Chuyển sang Ngừng bán";
    public const string ReceiptConfirmedMessage = "Phiếu đã nhập kho, không sửa, không xóa";
    public const string MissingExpiryMessage = "Nhập hạn sử dụng";
    public const string ExpiryBeforeReceiveMessage = "Hạn sử dụng phải sau ngày nhập";
    public const string ShiftNotNeedReviewMessage = "Chỉ ghi chú xử lý cho ca Cần kiểm tra";
    public const string NeedNoteMessage = "Chênh lệch quá 20.000 ₫, cần ghi chú";
    public const string WrongApproverMessage = "Tên đăng nhập hoặc mật khẩu không đúng";
    public const string NoDiscountOverrideMessage = "Tài khoản không có quyền xác nhận giảm giá";
    public const string NoReturnOverrideMessage = "Tài khoản không có quyền xác nhận đổi trả";
    public const string StaleDataMessage = "Tồn kho vừa thay đổi do quầy khác thao tác cùng lúc, thử lại";

    public static string ProductInactiveMessage(string name) => $"Hàng ngừng bán: {name}";

    public static string OverStockMessage(int shortage, string baseUnit, string name) =>
        $"Vượt tồn {shortage} {baseUnit.ToLowerInvariant()}: {name}";

    public static string NeedApprovalMessage(IEnumerable<string> reasons) => "Cần chủ cửa hàng xác nhận: " + string.Join("; ", reasons);

    public static string CashShortMessage(decimal missing) => $"Còn thiếu {PosRules.FormatVnd(missing)}";

    public static string OrderNotFoundMessage(string code) => $"Không tìm thấy hóa đơn {code}".TrimEnd();

    public static string FullyReturnedMessage(string code) => $"Hóa đơn {code} đã trả hết";

    public static string MaxReturnMessage(int max) => $"Tối đa {max}";

    public static string BarcodeUsedMessage(string productName, string unitName) => $"Mã đã dùng cho {productName} – {unitName}";

    public static string UnitUsedMessage(string unitName) => $"Đơn vị {unitName} đã có trong chứng từ, không xóa, không đổi hệ số";

    /// <summary>Lỗi 400 có <c>code</c>; <paramref name="field"/> khác null thì kèm <c>errors[field]</c> để FE gắn vào ô nhập.</summary>
    public static DomainException Create(string code, string message, string? field = null, IReadOnlyDictionary<string, object?>? extra = null)
    {
        var extensions = new Dictionary<string, object?> { ["code"] = code };
        if (field is not null)
            extensions["errors"] = new Dictionary<string, string[]> { [field] = [message] };
        if (extra is not null)
        {
            foreach (var (key, value) in extra)
                extensions[key] = value;
        }

        return new DomainException(message, extensions);
    }

    /// <summary>Mã lỗi của <see cref="DomainException"/> (null khi không có).</summary>
    public static string? CodeOf(DomainException exception) =>
        exception.Extensions.TryGetValue("code", out var code) ? code as string : null;
}
