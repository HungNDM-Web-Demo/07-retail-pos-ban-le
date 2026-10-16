using Domain.Base;
using Domain.Common;
using Domain.Enums.Pos.Shifts;

namespace Domain.Entities.Pos.Shifts;

/// <summary>Số tổng hợp của ca (07 §3.7), tính từ hóa đơn và phiếu đổi trả trong ca.</summary>
public sealed record ShiftTotals(
    int OrderCount,
    int ReturnCount,
    decimal CashSales,
    decimal TransferSales,
    decimal CardSales,
    decimal OffsetSales,
    decimal SalesTotal,
    decimal CashRefund,
    decimal TransferRefund,
    decimal OffsetRefund,
    decimal RefundTotal)
{
    public static readonly ShiftTotals Empty = new(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

    /// <summary>BR-21: đầu ca + tiền mặt thu − tiền mặt hoàn.</summary>
    public decimal ExpectedCash(decimal openingCash) => openingCash + CashSales - CashRefund;
}

/// <summary>
/// Ca thu ngân (bảng <c>Pos_Shifts</c>, UC-02, UC-09, UC-10). Mỗi thu ngân tối đa một ca đang mở (BR-21). Không xóa.
/// Ca đang mở tính số tổng hợp trực tiếp; chốt ca mới ghi cột.
/// </summary>
public class Shift : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int CodeMaxLength = 20;
    public const int NameMaxLength = 150;
    public const int NoteMaxLength = 1000;

    private Shift()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public Guid CashierId { get; private set; }
    public string CashierName { get; private set; } = string.Empty;
    public DateTime OpenedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }
    public decimal OpeningCash { get; private set; }
    public int OrderCount { get; private set; }
    public int ReturnCount { get; private set; }
    public decimal CashSales { get; private set; }
    public decimal TransferSales { get; private set; }
    public decimal CardSales { get; private set; }
    public decimal OffsetSales { get; private set; }
    public decimal SalesTotal { get; private set; }
    public decimal CashRefund { get; private set; }
    public decimal TransferRefund { get; private set; }
    public decimal OffsetRefund { get; private set; }
    public decimal RefundTotal { get; private set; }
    public decimal? ExpectedCash { get; private set; }
    public decimal? CountedCash { get; private set; }
    public string? CashCountJson { get; private set; }
    public decimal? Difference { get; private set; }
    public string? Note { get; private set; }
    public ShiftStatus Status { get; private set; }
    public string? ReviewNote { get; private set; }
    public Guid? ReviewedById { get; private set; }
    public string? ReviewedByName { get; private set; }
    public DateTime? ReviewedAt { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public bool IsOpen => Status == ShiftStatus.DangMo;

    public ShiftTotals StoredTotals => new(OrderCount, ReturnCount, CashSales, TransferSales, CardSales, OffsetSales, SalesTotal, CashRefund, TransferRefund, OffsetRefund, RefundTotal);

    /// <summary>UC-02: mở ca với tiền đầu ca; mã <c>CA</c> + <c>yyMMdd</c> + 2 số do service sinh.</summary>
    public static Shift Open(string code, Guid cashierId, string cashierName, DateTime openedAtUtc, decimal openingCash, Guid? id = null)
    {
        if (openingCash < 0)
            throw new DomainException("Nhập tiền đầu ca");

        var shift = new Shift
        {
            Id = id ?? Guid.NewGuid(),
            Code = code,
            CashierId = cashierId,
            CashierName = cashierName,
            OpenedAt = openedAtUtc,
            OpeningCash = openingCash,
            Status = ShiftStatus.DangMo
        };
        shift.CreatedAt = openedAtUtc;
        return shift;
    }

    /// <summary>
    /// UC-09: ghi số tổng hợp, tiền đếm, chênh lệch (BR-22). Lệch quá 20.000 ₫ thì bắt ghi chú và chuyển "Cần kiểm tra".
    /// </summary>
    public void Close(ShiftTotals totals, decimal countedCash, string? cashCountJson, string? note, DateTime closedAtUtc)
    {
        if (!IsOpen)
            throw PosErrors.Create(PosErrors.ChuaMoCa, PosErrors.NoShiftMessage);

        var expected = totals.ExpectedCash(OpeningCash);
        var difference = countedCash - expected;
        var needsReview = Math.Abs(difference) > PosRules.ShiftDifferenceThreshold;
        if (needsReview && string.IsNullOrWhiteSpace(note))
            throw PosErrors.Create(PosErrors.CanGhiChu, PosErrors.NeedNoteMessage, "note");

        OrderCount = totals.OrderCount;
        ReturnCount = totals.ReturnCount;
        CashSales = totals.CashSales;
        TransferSales = totals.TransferSales;
        CardSales = totals.CardSales;
        OffsetSales = totals.OffsetSales;
        SalesTotal = totals.SalesTotal;
        CashRefund = totals.CashRefund;
        TransferRefund = totals.TransferRefund;
        OffsetRefund = totals.OffsetRefund;
        RefundTotal = totals.RefundTotal;
        ExpectedCash = expected;
        CountedCash = countedCash;
        CashCountJson = cashCountJson;
        Difference = difference;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        ClosedAt = closedAtUtc;
        Status = needsReview ? ShiftStatus.CanKiemTra : ShiftStatus.DaChot;
    }

    /// <summary>UC-10: chủ cửa hàng ghi chú xử lý ca "Cần kiểm tra".</summary>
    public void Review(string note, Guid? reviewerId, string reviewerName, DateTime reviewedAtUtc)
    {
        if (Status != ShiftStatus.CanKiemTra)
            throw PosErrors.Create(PosErrors.CaKhongCanKiemTra, PosErrors.ShiftNotNeedReviewMessage);

        ReviewNote = note.Trim();
        ReviewedById = reviewerId;
        ReviewedByName = reviewerName;
        ReviewedAt = reviewedAtUtc;
        Status = ShiftStatus.DaKiemTra;
    }
}
