using System.Globalization;
using Application.Common.Time;
using Application.Constants;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Roles;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.System.Users;
using Domain.Enums.Inventory.Stock;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Common;

/// <summary>Người gọi và quyền liên quan tới phạm vi xem (07 §1): giá vốn, "ca của mình".</summary>
internal sealed class PosAccess(ICurrentUserService currentUser, IPermissionService permissions)
{
    private bool? _canViewCost;
    private bool? _canViewAll;

    public Guid UserId =>
        currentUser.UserId ?? throw new UnauthorizedAccessException("Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.");

    public string Username => currentUser.Username ?? string.Empty;

    public async Task<bool> CanViewCostAsync(CancellationToken ct) =>
        _canViewCost ??= await permissions.HasPermissionAsync(UserId, ProjectPermissions.Products.ViewCost, ct);

    /// <summary>Có <c>shifts.view</c>: xem mọi ca, mọi hóa đơn, phiếu đổi trả.</summary>
    public async Task<bool> CanViewAllAsync(CancellationToken ct) =>
        _canViewAll ??= await permissions.HasPermissionAsync(UserId, ProjectPermissions.Shifts.View, ct);

    public Task<bool> HasAsync(string permission, CancellationToken ct) => permissions.HasPermissionAsync(UserId, permission, ct);

    public async Task<string> FullNameAsync(IGenericRepository<User> users, CancellationToken ct)
    {
        var id = UserId;
        return await users.QueryNoTracking().Where(u => u.Id == id).Select(u => u.FullName).FirstOrDefaultAsync(ct) ?? Username;
    }
}

/// <summary>Mã chứng từ (SRS §5.3, BR-16, 07 §3.10): tiền tố + yyMMdd (giờ Việt Nam) + số thứ tự tiếp theo số lớn nhất trong ngày.</summary>
internal static class DocCodes
{
    public static string DayPrefix(string prefix, DateTime atUtc) =>
        prefix + VietnamDates.DateOf(atUtc).ToString("yyMMdd", CultureInfo.InvariantCulture);

    public static async Task<string> NextAsync(IQueryable<string> codes, string prefix, DateTime atUtc, int digits, CancellationToken ct)
    {
        var dayPrefix = DayPrefix(prefix, atUtc);
        var existing = await codes.Where(c => c.StartsWith(dayPrefix)).ToListAsync(ct);
        var max = existing
            .Select(c => int.TryParse(c.AsSpan(dayPrefix.Length), NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : 0)
            .DefaultIfEmpty(0)
            .Max();
        return dayPrefix + (max + 1).ToString(new string('0', digits), CultureInfo.InvariantCulture);
    }

    /// <summary>Mã danh mục: tiền tố + số lớn nhất + 1 (SP + 5 số, NCC + 3 số, NH + 2 số).</summary>
    public static string NextSequential(IEnumerable<string> codes, string prefix, int digits)
    {
        var max = codes
            .Where(c => c.StartsWith(prefix, StringComparison.Ordinal))
            .Select(c => int.TryParse(c.AsSpan(prefix.Length), NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : 0)
            .DefaultIfEmpty(0)
            .Max();
        return prefix + (max + 1).ToString(new string('0', digits), CultureInfo.InvariantCulture);
    }
}

/// <summary>
/// Ghi tồn, giá vốn và sổ biến động cho một chứng từ. Tồn đọc không theo dõi, tính trong bộ nhớ, rồi ghi bằng cập nhật có
/// điều kiện <c>Version</c> (không qua change tracker nên không sinh nhật ký thao tác cho mỗi lần bán). Lệch <c>Version</c>
/// → <see cref="StockConcurrencyException"/>, <see cref="PosTransaction"/> làm lại cả nghiệp vụ.
/// </summary>
internal sealed class StockLedger(IGenericRepository<Product> products, IGenericRepository<ProductUnit> units, IGenericRepository<StockMovement> movements)
{
    private readonly Dictionary<Guid, State> _states = [];
    private readonly List<(Guid ProductId, DateTime At, MovementType Type, Guid DocumentId, string DocumentCode, int Quantity, int StockAfter, decimal CostAfter)> _pending = [];
    private readonly HashSet<Guid> _usedUnits = [];

    public sealed class State
    {
        public required Guid Id { get; init; }
        public required int OriginalVersion { get; init; }
        public int Stock { get; set; }
        public decimal AvgCost { get; set; }
        public bool Changed { get; set; }
    }

    /// <summary>Đọc tồn, giá vốn, Version hiện tại của các mặt hàng (gọi trước mọi tính toán).</summary>
    public async Task LoadAsync(IEnumerable<Guid> productIds, CancellationToken ct)
    {
        var ids = productIds.Distinct().Where(id => !_states.ContainsKey(id)).ToList();
        if (ids.Count == 0)
            return;

        var rows = await products.QueryNoTracking().IgnoreQueryFilters()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new { p.Id, p.Stock, p.AvgCost, p.Version })
            .ToListAsync(ct);
        foreach (var row in rows)
            _states[row.Id] = new State { Id = row.Id, OriginalVersion = row.Version, Stock = row.Stock, AvgCost = row.AvgCost };
    }

    public State Get(Guid productId) => _states[productId];

    /// <summary>Đổi tồn (dương là tăng) và, khi có, giá vốn mới; ghi một dòng sổ biến động.</summary>
    public State Move(Guid productId, int quantity, MovementType type, Guid documentId, string documentCode, DateTime at, decimal? newAvgCost = null)
    {
        var state = _states[productId];
        state.Stock += quantity;
        if (newAvgCost is { } cost)
            state.AvgCost = cost;
        state.Changed = true;
        _pending.Add((productId, at, type, documentId, documentCode, quantity, state.Stock, state.AvgCost));
        return state;
    }

    public void MarkUnitUsed(Guid unitId) => _usedUnits.Add(unitId);

    /// <summary>Ghi tồn có điều kiện Version, đánh dấu đơn vị đã dùng, thêm dòng sổ biến động (lưu khi SaveChanges).</summary>
    public async Task FlushAsync(CancellationToken ct)
    {
        foreach (var state in _states.Values.Where(s => s.Changed))
        {
            var id = state.Id;
            var version = state.OriginalVersion;
            var stock = state.Stock;
            var cost = state.AvgCost;
            var affected = await products.Query().IgnoreQueryFilters()
                .Where(p => p.Id == id && p.Version == version)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.Stock, stock)
                    .SetProperty(p => p.AvgCost, cost)
                    .SetProperty(p => p.Version, version + 1), ct);
            if (affected == 0)
                throw new StockConcurrencyException();
        }

        if (_usedUnits.Count > 0)
        {
            var unitIds = _usedUnits.ToList();
            await units.Query().Where(u => unitIds.Contains(u.Id) && !u.EverUsed)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.EverUsed, true), ct);
        }

        if (_pending.Count > 0)
        {
            var seq = await movements.QueryNoTracking().Select(m => (long?)m.Seq).MaxAsync(ct) ?? 0;
            foreach (var m in _pending)
                await movements.AddAsync(StockMovement.Create(m.ProductId, m.At, m.Type, m.DocumentId, m.DocumentCode, m.Quantity, m.StockAfter, m.CostAfter, ++seq), ct);
        }
    }
}
