using Domain.Enums.Pos.Approvals;
using Domain.Enums.Pos.Orders;

namespace Domain.Entities.Pos;

/// <summary>Giảm giá nhập ở dòng hoặc hóa đơn (07 §2.4 <c>DiscountInput</c>).</summary>
public sealed record DiscountSpec(DiscountType Type, decimal Value, DiscountReason Reason, string? Note = null);

/// <summary>Một dòng giỏ đã tra hàng hóa, đơn vị, giá, giá vốn hiện tại.</summary>
public sealed record PricingLineInput(
    Guid ProductId,
    string ProductCode,
    string ProductName,
    Guid GroupId,
    Guid UnitId,
    string UnitName,
    int Factor,
    decimal UnitPrice,
    decimal AvgCost,
    bool Returnable,
    int Quantity,
    DiscountSpec? Discount = null);

/// <summary>Dòng đã tính tiền (BR-06, BR-07, BR-13, BR-14).</summary>
public sealed class PricedLine
{
    public required int LineNo { get; init; }
    public required PricingLineInput Input { get; init; }
    public decimal Amount { get; init; }
    public decimal DiscountAmount { get; init; }
    public decimal AllocatedDiscount { get; internal set; }
    public decimal NetAmount { get; internal set; }
    public int BaseQty => Input.Quantity * Input.Factor;
    public decimal UnitCost => Input.AvgCost;
    public decimal CostAmount => BaseQty * Input.AvgCost;
}

/// <summary>Lý do cần chủ cửa hàng xác nhận, vd <c>{ code: "VuotHanMuc", text: "Giảm 7,3%, vượt hạn mức 5%" }</c>.</summary>
public sealed record ApprovalReason(ApprovalReasonCode Code, string Text);

/// <summary>Giỏ đã tính tiền (07 §3.1–3.4).</summary>
public sealed class PricedCart
{
    public required IReadOnlyList<PricedLine> Lines { get; init; }
    public decimal Subtotal { get; init; }
    public decimal LineDiscountTotal { get; init; }
    public DiscountSpec? OrderDiscount { get; init; }
    public decimal OrderDiscountAmount { get; init; }
    public decimal DiscountTotal => LineDiscountTotal + OrderDiscountAmount;
    public decimal Total { get; init; }
    public decimal CostTotal => Lines.Sum(l => l.CostAmount);

    /// <summary>discountTotal ÷ subtotal × 100, chưa làm tròn (so hạn mức).</summary>
    public decimal DiscountPctRaw => Subtotal == 0 ? 0 : DiscountTotal / Subtotal * 100;

    public decimal DiscountPct => PosRules.Round1Digit(DiscountPctRaw);

    /// <summary>BR-08, BR-09 (07 §3.4).</summary>
    public IReadOnlyList<ApprovalReason> ApprovalReasons
    {
        get
        {
            var reasons = new List<ApprovalReason>();
            if (DiscountPctRaw > PosRules.CashierDiscountLimitPct)
            {
                reasons.Add(new ApprovalReason(
                    ApprovalReasonCode.VuotHanMuc,
                    $"Giảm {PosRules.FormatPercent(DiscountPctRaw)}%, vượt hạn mức {PosRules.FormatPercent(PosRules.CashierDiscountLimitPct)}%"));
            }

            if (Total < CostTotal)
                reasons.Add(new ApprovalReason(ApprovalReasonCode.DuoiGiaVon, $"Thấp hơn giá vốn {PosRules.FormatVnd(CostTotal - Total)}"));

            return reasons;
        }
    }

    public bool NeedsApproval => ApprovalReasons.Count > 0;
}

/// <summary>
/// Công thức tiền dùng chung cho thanh toán, báo giá, đổi hàng và nạp dữ liệu mẫu (07 §3; FE <c>features/pos/lib/pricing.ts</c>).
/// </summary>
public static class OrderPricing
{
    /// <summary>
    /// Số tiền giảm của <paramref name="baseAmount"/>: phần trăm → floor500; số tiền → giá trị nhập. Số tiền lớn hơn
    /// <paramref name="baseAmount"/>: <paramref name="strict"/> thì trả null (người gọi báo GiamQuaTongTien), không thì lấy bằng.
    /// </summary>
    public static decimal? DiscountAmount(decimal baseAmount, DiscountSpec discount, bool strict = true)
    {
        if (discount.Type == DiscountType.PhanTram)
            return PosRules.Floor500(baseAmount * discount.Value / 100);

        if (discount.Value <= baseAmount)
            return discount.Value;

        return strict ? null : baseAmount;
    }

    /// <summary>
    /// Tính giỏ: dòng (BR-06), giảm dòng, giảm hóa đơn (BR-07), phân bổ (BR-14, dòng cuối nhận phần dư), giá vốn (BR-13).
    /// <paramref name="strict"/> = true (API): giảm số tiền vượt phần được giảm → lỗi <c>GiamQuaTongTien</c>.
    /// </summary>
    public static PricedCart Price(IReadOnlyList<PricingLineInput> inputs, DiscountSpec? orderDiscount, bool strict = true)
    {
        var lines = new List<PricedLine>(inputs.Count);
        for (var i = 0; i < inputs.Count; i++)
        {
            var input = inputs[i];
            var amount = input.UnitPrice * input.Quantity;
            decimal lineDiscount = 0;
            if (input.Discount is { } discount)
            {
                lineDiscount = DiscountAmount(amount, discount, strict)
                    ?? throw PosErrors.Create(PosErrors.GiamQuaTongTien, PosErrors.DiscountTooLargeMessage, $"lines[{i}].discount.value");
            }

            lines.Add(new PricedLine { LineNo = i + 1, Input = input, Amount = amount, DiscountAmount = lineDiscount });
        }

        var subtotal = lines.Sum(l => l.Amount);
        var lineDiscountTotal = lines.Sum(l => l.DiscountAmount);
        var afterLine = subtotal - lineDiscountTotal;
        decimal orderDiscountAmount = 0;
        if (orderDiscount is not null)
        {
            orderDiscountAmount = DiscountAmount(afterLine, orderDiscount, strict)
                ?? throw PosErrors.Create(PosErrors.GiamQuaTongTien, PosErrors.DiscountTooLargeMessage, "orderDiscount.value");
        }

        decimal allocated = 0;
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var lineBase = line.Amount - line.DiscountAmount;
            line.AllocatedDiscount = i == lines.Count - 1
                ? orderDiscountAmount - allocated
                : afterLine == 0 ? 0 : PosRules.RoundVnd(orderDiscountAmount * lineBase / afterLine);
            allocated += line.AllocatedDiscount;
            line.NetAmount = lineBase - line.AllocatedDiscount;
        }

        return new PricedCart
        {
            Lines = lines,
            Subtotal = subtotal,
            LineDiscountTotal = lineDiscountTotal,
            OrderDiscount = orderDiscount,
            OrderDiscountAmount = orderDiscountAmount,
            Total = Math.Max(0, afterLine - orderDiscountAmount)
        };
    }

    /// <summary>
    /// Tiền hoàn của một dòng (BR-18, 07 §3.6): trả hết phần còn lại → phần thuần còn lại; còn lại → floor500(thuần × q ÷ SL).
    /// </summary>
    public static decimal RefundForLine(decimal netAmount, decimal refundedAmount, int quantity, int returnedQty, int returnQty) =>
        returnedQty + returnQty >= quantity
            ? netAmount - refundedAmount
            : PosRules.Floor500(netAmount * returnQty / quantity);
}
