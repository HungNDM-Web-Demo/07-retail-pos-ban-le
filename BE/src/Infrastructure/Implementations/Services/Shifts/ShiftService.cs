using System.Text.Json;
using Application.Common.Exceptions;
using Application.Common.Models;
using Application.DTOs.Shifts;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Roles;
using Application.Interfaces.Services.Shifts;
using Application.Mappings.Orders;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Returns;
using Domain.Entities.Pos.Shifts;
using Domain.Entities.System.Users;
using Domain.Enums.Pos.Approvals;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Returns;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Common;
using Infrastructure.Implementations.Services.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Shifts;

/// <summary>
/// Ca thu ngân (UC-02, UC-09, UC-10, BR-21, BR-22, 07 §2.7, §3.7). Ca đang mở tính số tổng hợp trực tiếp từ hóa đơn,
/// phiếu đổi trả; chốt ca mới ghi cột.
/// </summary>
public sealed class ShiftService(
    IGenericRepository<Shift> shifts,
    IGenericRepository<Order> orders,
    IGenericRepository<Return> returns,
    IGenericRepository<OrderPayment> payments,
    IGenericRepository<User> users,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IPermissionService permissionService,
    TimeProvider timeProvider) : IShiftService
{
    public const string CodePrefix = "CA";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly PosAccess _access = new(currentUser, permissionService);

    private DateTime Now => timeProvider.GetUtcNow().UtcDateTime;

    public async Task<ShiftDto?> GetCurrentAsync(CancellationToken ct = default)
    {
        var shift = await shifts.QueryNoTracking().OpenShiftOfAsync(_access.UserId, ct);
        return shift is null ? null : await ToDtoAsync(shift, ct);
    }

    public async Task<OpenShiftResult> OpenAsync(OpenShiftRequest request, CancellationToken ct = default)
    {
        var userId = _access.UserId;
        if (await shifts.QueryNoTracking().OpenShiftOfAsync(userId, ct) is { } open)
            return new OpenShiftResult(await ToDtoAsync(open, ct), Created: false);

        var now = Now;
        var name = await _access.FullNameAsync(users, ct);
        var code = await DocCodes.NextAsync(shifts.QueryNoTracking().Select(s => s.Code), CodePrefix, now, 2, ct);
        var shift = Shift.Open(code, userId, name, now, request.OpeningCash ?? 0);
        await shifts.AddAsync(shift, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return new OpenShiftResult(ShiftMappings.ToDto(shift, ShiftTotals.Empty), Created: true);
    }

    public async Task<ShiftDto> CloseCurrentAsync(CloseShiftRequest request, CancellationToken ct = default)
    {
        var shift = await shifts.Query().OpenShiftOfAsync(_access.UserId, ct)
            ?? throw PosErrors.Create(PosErrors.ChuaMoCa, PosErrors.NoShiftMessage);

        var totals = (await ComputeTotalsAsync([shift.Id], ct))[shift.Id];
        var counted = request.CashCount.Sum(i => (decimal)i.Denomination * i.Count);
        var json = JsonSerializer.Serialize(request.CashCount.Where(i => i.Count > 0).OrderByDescending(i => i.Denomination).ToList(), JsonOptions);
        shift.Close(totals, counted, json, request.Note, Now);
        await unitOfWork.SaveChangesAsync(ct);
        return ShiftMappings.ToDto(shift, shift.StoredTotals);
    }

    public async Task<PaginatedResult<ShiftDto>> GetPagedAsync(ShiftQuery query, CancellationToken ct = default)
    {
        var source = shifts.QueryNoTracking();
        var (from, to) = PosQueries.UtcRange(query.From, query.To);
        if (from is { } f)
            source = source.Where(s => s.OpenedAt >= f);
        if (to is { } t)
            source = source.Where(s => s.OpenedAt < t);
        if (query.CashierId is { } cashierId)
            source = source.Where(s => s.CashierId == cashierId);
        if (query.Status is { } status)
            source = source.Where(s => s.Status == status);

        if (string.IsNullOrWhiteSpace(query.SortBy))
            query.SortBy = nameof(Shift.OpenedAt);

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var openIds = page.Items.Where(s => s.IsOpen).Select(s => s.Id).ToList();
        var live = openIds.Count == 0 ? new Dictionary<Guid, ShiftTotals>() : await ComputeTotalsAsync(openIds, ct);
        return page.Map(items => items.Select(s => ShiftMappings.ToDto(s, s.IsOpen ? live[s.Id] : s.StoredTotals)).ToList());
    }

    public async Task<ShiftDetail> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var shift = await shifts.QueryNoTracking().FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy ca");
        if (shift.CashierId != _access.UserId && !await _access.CanViewAllAsync(ct))
            throw new ForbiddenException("Bạn chỉ xem được ca của mình (cần quyền shifts.view).");

        var dto = await ToDtoAsync(shift, ct);
        var shiftOrders = await orders.QueryNoTracking().WithListDetails().Where(o => o.ShiftId == id).OrderBy(o => o.PaidAt).ToListAsync(ct);
        var shiftReturns = await returns.QueryNoTracking().WithListDetails().Where(r => r.ShiftId == id).OrderBy(r => r.CreatedAt).ToListAsync(ct);

        var approvals = shiftOrders.Where(o => o.ApprovedByName != null)
            .Select(o => new ShiftApprovalItem { Action = ApprovalAction.GiamGia, DocumentId = o.Id, DocumentCode = o.Code, ApprovedByName = o.ApprovedByName!, Amount = o.DiscountTotal, At = o.PaidAt })
            .Concat(shiftReturns.Where(r => r.ApprovedByName != null)
                .Select(r => new ShiftApprovalItem { Action = ApprovalAction.DoiTra, DocumentId = r.Id, DocumentCode = r.Code, ApprovedByName = r.ApprovedByName!, Amount = r.RefundTotal, At = r.CreatedAt }))
            .OrderBy(a => a.At)
            .ToList();

        return new ShiftDetail
        {
            Id = dto.Id,
            Code = dto.Code,
            Status = dto.Status,
            CashierId = dto.CashierId,
            CashierName = dto.CashierName,
            OpenedAt = dto.OpenedAt,
            ClosedAt = dto.ClosedAt,
            OpeningCash = dto.OpeningCash,
            OrderCount = dto.OrderCount,
            ReturnCount = dto.ReturnCount,
            SalesByMethod = dto.SalesByMethod,
            SalesTotal = dto.SalesTotal,
            RefundByMethod = dto.RefundByMethod,
            RefundTotal = dto.RefundTotal,
            NetRevenue = dto.NetRevenue,
            ExpectedCash = dto.ExpectedCash,
            CountedCash = dto.CountedCash,
            Difference = dto.Difference,
            CashCount = dto.CashCount,
            Note = dto.Note,
            ReviewNote = dto.ReviewNote,
            ReviewedByName = dto.ReviewedByName,
            ReviewedAt = dto.ReviewedAt,
            Orders = shiftOrders.Select(o => o.ToListItem()).ToList(),
            Returns = shiftReturns.Select(r => r.ToListItem()).ToList(),
            Approvals = approvals
        };
    }

    public async Task<ShiftDto> ReviewAsync(Guid id, ReviewShiftRequest request, CancellationToken ct = default)
    {
        var shift = await shifts.Query().FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy ca");
        shift.Review(request.Note, _access.UserId, await _access.FullNameAsync(users, ct), Now);
        await unitOfWork.SaveChangesAsync(ct);
        return ShiftMappings.ToDto(shift, shift.StoredTotals);
    }

    private async Task<ShiftDto> ToDtoAsync(Shift shift, CancellationToken ct) =>
        ShiftMappings.ToDto(shift, shift.IsOpen ? (await ComputeTotalsAsync([shift.Id], ct))[shift.Id] : shift.StoredTotals);

    /// <summary>07 §3.7: tổng hợp từ khoản thu hóa đơn và phiếu đổi trả của ca.</summary>
    private async Task<Dictionary<Guid, ShiftTotals>> ComputeTotalsAsync(IReadOnlyList<Guid> shiftIds, CancellationToken ct)
    {
        var ids = shiftIds.ToList();
        var orderRows = await orders.QueryNoTracking()
            .Where(o => ids.Contains(o.ShiftId))
            .Select(o => new { o.ShiftId, o.Total })
            .ToListAsync(ct);
        var paymentRows = await payments.QueryNoTracking()
            .Join(orders.QueryNoTracking().Where(o => ids.Contains(o.ShiftId)), p => p.OrderId, o => o.Id, (p, o) => new { o.ShiftId, p.Method, p.Amount })
            .ToListAsync(ct);
        var returnRows = await returns.QueryNoTracking()
            .Where(r => ids.Contains(r.ShiftId))
            .Select(r => new { r.ShiftId, r.RefundTotal, r.PayoutAmount, r.OffsetAmount, r.RefundMethod })
            .ToListAsync(ct);

        return ids.ToDictionary(id => id, id =>
        {
            var rs = returnRows.Where(r => r.ShiftId == id).ToList();
            decimal Sales(PaymentMethod m) => paymentRows.Where(p => p.ShiftId == id && p.Method == m).Sum(p => p.Amount);
            return new ShiftTotals(
                orderRows.Count(o => o.ShiftId == id),
                rs.Count,
                Sales(PaymentMethod.TienMat),
                Sales(PaymentMethod.ChuyenKhoan),
                Sales(PaymentMethod.The),
                Sales(PaymentMethod.BuTruDoiHang),
                orderRows.Where(o => o.ShiftId == id).Sum(o => o.Total),
                rs.Where(r => r.RefundMethod == RefundMethod.TienMat).Sum(r => r.PayoutAmount),
                rs.Where(r => r.RefundMethod == RefundMethod.ChuyenKhoan).Sum(r => r.PayoutAmount),
                rs.Sum(r => r.OffsetAmount),
                rs.Sum(r => r.RefundTotal));
        });
    }
}

/// <summary>Ánh xạ ca sang DTO (07 §2.7).</summary>
internal static class ShiftMappings
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static ShiftDto ToDto(Shift shift, ShiftTotals totals) => new()
    {
        Id = shift.Id,
        Code = shift.Code,
        Status = shift.Status,
        CashierId = shift.CashierId,
        CashierName = shift.CashierName,
        OpenedAt = shift.OpenedAt,
        ClosedAt = shift.ClosedAt,
        OpeningCash = shift.OpeningCash,
        OrderCount = totals.OrderCount,
        ReturnCount = totals.ReturnCount,
        SalesByMethod = new Dictionary<string, decimal>
        {
            [nameof(PaymentMethod.TienMat)] = totals.CashSales,
            [nameof(PaymentMethod.ChuyenKhoan)] = totals.TransferSales,
            [nameof(PaymentMethod.The)] = totals.CardSales,
            [nameof(PaymentMethod.BuTruDoiHang)] = totals.OffsetSales
        },
        SalesTotal = totals.SalesTotal,
        RefundByMethod = new Dictionary<string, decimal>
        {
            [nameof(RefundMethod.TienMat)] = totals.CashRefund,
            [nameof(RefundMethod.ChuyenKhoan)] = totals.TransferRefund,
            [nameof(PaymentMethod.BuTruDoiHang)] = totals.OffsetRefund
        },
        RefundTotal = totals.RefundTotal,
        NetRevenue = totals.SalesTotal - totals.RefundTotal,
        ExpectedCash = shift.ExpectedCash ?? totals.ExpectedCash(shift.OpeningCash),
        CountedCash = shift.CountedCash,
        Difference = shift.Difference,
        CashCount = string.IsNullOrWhiteSpace(shift.CashCountJson) ? null : JsonSerializer.Deserialize<List<CashCountItem>>(shift.CashCountJson, JsonOptions),
        Note = shift.Note,
        ReviewNote = shift.ReviewNote,
        ReviewedByName = shift.ReviewedByName,
        ReviewedAt = shift.ReviewedAt
    };
}
