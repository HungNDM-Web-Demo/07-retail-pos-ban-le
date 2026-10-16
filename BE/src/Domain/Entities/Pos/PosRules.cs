using System.Globalization;

namespace Domain.Entities.Pos;

/// <summary>
/// Hằng số nghiệp vụ (06 §3, 07 §3). FE khai báo giống hệt ở <c>src/config/pos-rules.ts</c>. Không phải cài đặt: đổi thì sửa SRS trước.
/// </summary>
public static class PosRules
{
    /// <summary>BR-04, BR-07: giá bán, giảm theo số tiền là bội số của số này.</summary>
    public const int PriceStep = 500;

    /// <summary>BR-01: hệ số đơn vị quy đổi.</summary>
    public const int MinFactor = 2;
    public const int MaxFactor = 1000;

    /// <summary>FR-05.</summary>
    public const int MaxConversionUnits = 3;

    /// <summary>BR-05: tiền tố n*.</summary>
    public const int MaxScanPrefix = 999;

    /// <summary>Số lượng một dòng giỏ, dòng phiếu nhập.</summary>
    public const int MaxLineQuantity = 9999;

    /// <summary>BR-11 (chỉ FE dùng).</summary>
    public const int MaxHeldTabs = 5;

    /// <summary>BR-08: thu ngân tự giảm tối đa (% tổng tiền hàng); "&gt; 5" mới cần xác nhận (07 §5 quyết định 6).</summary>
    public const decimal CashierDiscountLimitPct = 5m;

    /// <summary>BR-17.</summary>
    public const int FreeReturnDays = 7;
    public const int MaxReturnDays = 30;

    /// <summary>BR-18.</summary>
    public const decimal RefundApprovalThreshold = 500_000m;

    /// <summary>BR-22.</summary>
    public const decimal ShiftDifferenceThreshold = 20_000m;

    /// <summary>BR-25.</summary>
    public const decimal LowMarginPct = 5m;

    /// <summary>BR-27.</summary>
    public const int ExpiryWarningDays = 30;

    /// <summary>BR-31: 20.000 ₫ một điểm.</summary>
    public const decimal PointValue = 20_000m;

    /// <summary>Báo cáo: khoảng ngày tối đa.</summary>
    public const int MaxReportDays = 366;

    /// <summary>BR-03: tiền tố mã vạch nội bộ.</summary>
    public const string InternalBarcodePrefix = "20";

    /// <summary>Mã xác nhận của chủ cửa hàng sống 15 phút, dùng một lần (07 §2.5).</summary>
    public static readonly TimeSpan ApprovalLifetime = TimeSpan.FromMinutes(15);

    /// <summary>Mệnh giá đếm tiền khi chốt ca (07 §3.7, §5 quyết định 32).</summary>
    public static readonly IReadOnlyList<int> Denominations = [500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500];

    private static readonly CultureInfo Vietnamese = CultureInfo.GetCultureInfo("vi-VN");

    /// <summary>"3.000 ₫" (khoảng trắng không ngắt như <c>formatVnd</c> của FE).</summary>
    public static string FormatVnd(decimal amount)
    {
        var rounded = Math.Round(amount, 0, MidpointRounding.AwayFromZero);
        var text = Math.Abs(rounded).ToString("#,0", CultureInfo.InvariantCulture).Replace(',', '.');
        return (rounded < 0 ? "−" : string.Empty) + text + " ₫";
    }

    /// <summary>Phần trăm tối đa 1 chữ số thập phân, dấu phẩy: 7,3 · 10 · 4,7.</summary>
    public static string FormatPercent(decimal value) =>
        Math.Round(value, 1, MidpointRounding.AwayFromZero).ToString("0.#", Vietnamese);

    /// <summary>Làm tròn 1 chữ số thập phân, nửa lên (phần trăm trong DTO).</summary>
    public static decimal Round1Digit(decimal value) => Math.Round(value, 1, MidpointRounding.AwayFromZero);

    /// <summary>round1 của 07 §3: làm tròn tới 1 ₫, nửa lên.</summary>
    public static decimal RoundVnd(decimal value) => Math.Round(value, 0, MidpointRounding.AwayFromZero);

    /// <summary>floor500 của 07 §3: làm tròn xuống tới bội số 500.</summary>
    public static decimal Floor500(decimal value) => Math.Floor(value / PriceStep) * PriceStep;

    /// <summary>BR-31: số điểm của số tiền.</summary>
    public static int PointsFor(decimal amount) => amount <= 0 ? 0 : (int)Math.Floor(amount / PointValue);
}
