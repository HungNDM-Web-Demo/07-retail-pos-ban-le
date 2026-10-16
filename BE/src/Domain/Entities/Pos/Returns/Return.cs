using Domain.Base;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Shifts;
using Domain.Enums.Pos.Returns;

namespace Domain.Entities.Pos.Returns;

/// <summary>Thông tin đầu phiếu đổi trả.</summary>
public sealed record ReturnHeader(
    string Code,
    DateTime CreatedAt,
    Guid ShiftId,
    Guid CashierId,
    string CashierName,
    Guid OrderId,
    RefundMethod RefundMethod,
    string? ClientRequestId = null,
    string? Note = null,
    Guid? ApprovedById = null,
    string? ApprovedByName = null,
    Guid? Id = null);

/// <summary>
/// Phiếu đổi trả (bảng <c>Pos_Returns</c>, UC-07). Tiền hoàn theo BR-18; có hàng đổi thì phần hoàn trừ vào hóa đơn đổi
/// (<see cref="OffsetAmount"/>), phần còn lại trả khách bằng <see cref="RefundMethod"/> (BR-20). Không xóa.
/// </summary>
public class Return : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int CodeMaxLength = 20;
    public const int ClientRequestIdMaxLength = 64;
    public const int NameMaxLength = 150;
    public const int ApprovedByNameMaxLength = 50;
    public const int NoteMaxLength = 500;

    private readonly List<ReturnLine> _lines = [];

    private Return()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string? ClientRequestId { get; private set; }
    public Guid ShiftId { get; private set; }
    public Shift? Shift { get; private set; }
    public Guid CashierId { get; private set; }
    public string CashierName { get; private set; } = string.Empty;
    public Guid OrderId { get; private set; }
    public Order? Order { get; private set; }
    public decimal RefundTotal { get; private set; }
    public decimal OffsetAmount { get; private set; }
    public decimal PayoutAmount { get; private set; }
    public RefundMethod RefundMethod { get; private set; }
    public Guid? ExchangeOrderId { get; private set; }
    public Order? ExchangeOrder { get; private set; }
    public Guid? ApprovedById { get; private set; }
    public string? ApprovedByName { get; private set; }
    public string? Note { get; private set; }
    public int PointsDeducted { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public IReadOnlyCollection<ReturnLine> Lines => _lines;

    public static Return Create(ReturnHeader header)
    {
        var note = string.IsNullOrWhiteSpace(header.Note) ? null : header.Note.Trim();
        var entity = new Return
        {
            Id = header.Id ?? Guid.NewGuid(),
            Code = header.Code,
            ClientRequestId = header.ClientRequestId,
            ShiftId = header.ShiftId,
            CashierId = header.CashierId,
            CashierName = header.CashierName,
            OrderId = header.OrderId,
            RefundMethod = header.RefundMethod,
            Note = note is null ? null : note[..Math.Min(note.Length, NoteMaxLength)],
            ApprovedById = header.ApprovedById,
            ApprovedByName = header.ApprovedByName
        };
        entity.CreatedAt = header.CreatedAt;
        return entity;
    }

    /// <summary>Thêm dòng trả theo dòng hóa đơn gốc; giá vốn lấy giá vốn đã chụp trên dòng gốc (07 §3.6).</summary>
    public ReturnLine AddLine(OrderLine source, int quantity, ReturnCondition condition, ReturnReason reason, string? note, decimal refundAmount)
    {
        var line = ReturnLine.Create(Id, source, quantity, condition, reason, note, refundAmount);
        _lines.Add(line);
        RefundTotal = _lines.Sum(l => l.RefundAmount);
        PayoutAmount = RefundTotal - OffsetAmount;
        return line;
    }

    /// <summary>BR-20: bù trừ = min(tiền hoàn, tổng hóa đơn đổi); phần còn lại trả khách.</summary>
    public void SetExchange(Guid exchangeOrderId, decimal exchangeTotal)
    {
        ExchangeOrderId = exchangeOrderId;
        OffsetAmount = Math.Min(RefundTotal, exchangeTotal);
        PayoutAmount = RefundTotal - OffsetAmount;
    }

    public void SetPointsDeducted(int points) => PointsDeducted = points;
}
