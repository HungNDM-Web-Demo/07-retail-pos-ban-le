using Domain.Common;
using Domain.Enums.Inventory.Stock;

namespace Domain.Entities.Pos;

/// <summary>Tên và hệ số một đơn vị, để đọc tồn quy đổi (BR-02).</summary>
public sealed record UnitFactor(string Name, int Factor);

/// <summary>Một lô (dòng phiếu nhập đã nhập kho của hàng có HSD, BR-27).</summary>
public sealed record LotInput(Guid Id, DateOnly ReceivedDate, DateTime? ConfirmedAt, int LineNo, int ReceivedQty, DateOnly ExpiryDate);

/// <summary>Lô kèm số còn lại ước tính và trạng thái.</summary>
public sealed record LotEstimate(LotInput Lot, int RemainingQty, int DaysLeft, LotStatus Status);

/// <summary>
/// Tồn, giá vốn, lô (07 §3.8; FE <c>features/pos/lib/stock-math.ts</c>). Tồn và giá vốn theo đơn vị cơ bản.
/// </summary>
public static class StockMath
{
    /// <summary>
    /// BR-02: tồn &gt; 0 chia lần lượt cho đơn vị hệ số lớn → nhỏ ("2 thùng 2 lon"); tồn 0 → "0 lon"; tồn âm → "−3 lon".
    /// </summary>
    public static string StockText(int stock, IEnumerable<UnitFactor> units)
    {
        var ordered = units.OrderByDescending(u => u.Factor).ToList();
        var baseUnit = ordered.LastOrDefault(u => u.Factor == 1) ?? ordered.LastOrDefault();
        var baseWord = baseUnit is null ? string.Empty : VietnameseText.FirstWordLower(baseUnit.Name);

        if (stock == 0)
            return $"0 {baseWord}";
        if (stock < 0)
            return $"−{-stock} {baseWord}";

        var parts = new List<string>();
        var left = stock;
        foreach (var unit in ordered.Where(u => u.Factor > 0))
        {
            var count = left / unit.Factor;
            if (count <= 0)
                continue;

            parts.Add($"{count} {VietnameseText.FirstWordLower(unit.Name)}");
            left %= unit.Factor;
        }

        return string.Join(' ', parts);
    }

    /// <summary>BR-26.</summary>
    public static StockStatus StatusOf(int stock, int minStock) =>
        stock < 0 ? StockStatus.AmKho
        : stock == 0 ? StockStatus.HetHang
        : stock <= minStock ? StockStatus.SapHet
        : StockStatus.ConHang;

    /// <summary>BR-25: (giá − vốn) ÷ giá × 100, 1 chữ số; null khi giá 0.</summary>
    public static decimal? MarginPct(decimal price, decimal avgCost) =>
        price <= 0 ? null : PosRules.Round1Digit((price - avgCost) / price * 100);

    public static bool IsLowMargin(decimal? marginPct) => marginPct is { } pct && pct < PosRules.LowMarginPct;

    /// <summary>
    /// BR-23 (và BR-19 khi trả hàng bán lại được): tồn hiện tại ≤ 0 → giá nhập; ngược lại bình quân gia quyền, làm tròn 1 ₫.
    /// <paramref name="unitCostIn"/> là giá một đơn vị cơ bản (unitPrice ÷ factor, không làm tròn).
    /// </summary>
    public static decimal NextAvgCost(int stock, decimal avgCost, int quantityIn, decimal unitCostIn) =>
        stock <= 0
            ? PosRules.RoundVnd(unitCostIn)
            : PosRules.RoundVnd((stock * avgCost + quantityIn * unitCostIn) / (stock + quantityIn));

    /// <summary>
    /// BR-27: lô mới → cũ (ngày nhập, giờ xác nhận, số dòng), mỗi lô nhận min(còn lại, số nhập) của max(tồn, 0).
    /// daysLeft &lt; 0 → Đã hết hạn; ≤ 30 → Sắp hết hạn; lô còn 0 luôn là Còn hạn.
    /// </summary>
    public static IReadOnlyList<LotEstimate> EstimateLots(int stock, IEnumerable<LotInput> lots, DateOnly today)
    {
        var left = Math.Max(stock, 0);
        var result = new List<LotEstimate>();
        foreach (var lot in lots
                     .OrderByDescending(l => l.ReceivedDate)
                     .ThenByDescending(l => l.ConfirmedAt)
                     .ThenByDescending(l => l.LineNo))
        {
            var take = Math.Min(left, lot.ReceivedQty);
            left -= take;
            var daysLeft = lot.ExpiryDate.DayNumber - today.DayNumber;
            var status = take > 0 && daysLeft < 0 ? LotStatus.DaHetHan
                : take > 0 && daysLeft <= PosRules.ExpiryWarningDays ? LotStatus.SapHetHan
                : LotStatus.ConHan;
            result.Add(new LotEstimate(lot, take, daysLeft, status));
        }

        return result;
    }
}
