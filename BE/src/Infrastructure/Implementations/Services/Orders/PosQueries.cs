using Application.Common.Time;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Returns;
using Domain.Entities.Pos.Shifts;
using Domain.Enums.Pos.Shifts;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Orders;

/// <summary>Truy vấn dùng chung cho hóa đơn, phiếu đổi trả, ca.</summary>
internal static class PosQueries
{
    public static IQueryable<Order> WithDetails(this IQueryable<Order> query) =>
        query.Include(o => o.Lines)
            .Include(o => o.Payments)
            .Include(o => o.Shift)
            .Include(o => o.Customer)
            .Include(o => o.Returns)
            .AsSplitQuery();

    public static IQueryable<Order> WithListDetails(this IQueryable<Order> query) =>
        query.Include(o => o.Lines)
            .Include(o => o.Payments)
            .Include(o => o.Shift)
            .Include(o => o.Customer)
            .AsSplitQuery();

    public static IQueryable<Return> WithDetails(this IQueryable<Return> query) =>
        query.Include(r => r.Lines).ThenInclude(l => l.OrderLine)
            .Include(r => r.Order)
            .Include(r => r.ExchangeOrder)
            .Include(r => r.Shift)
            .AsSplitQuery();

    public static IQueryable<Return> WithListDetails(this IQueryable<Return> query) =>
        query.Include(r => r.Lines)
            .Include(r => r.Order)
            .Include(r => r.ExchangeOrder)
            .AsSplitQuery();

    public static Task<Shift?> OpenShiftOfAsync(this IQueryable<Shift> shifts, Guid cashierId, CancellationToken ct) =>
        shifts.Where(s => s.CashierId == cashierId && s.Status == ShiftStatus.DangMo)
            .OrderByDescending(s => s.OpenedAt)
            .FirstOrDefaultAsync(ct);

    /// <summary>Khoảng [from 00:00, to + 1 ngày 00:00) giờ Việt Nam, đổi ra UTC; tham số vắng thì không giới hạn phía đó.</summary>
    public static (DateTime? From, DateTime? To) UtcRange(string? from, string? to) =>
        (VietnamDates.TryParse(from, out var f) ? VietnamDates.StartOfDayUtc(f) : null,
         VietnamDates.TryParse(to, out var t) ? VietnamDates.EndOfDayExclusiveUtc(t) : null);
}
