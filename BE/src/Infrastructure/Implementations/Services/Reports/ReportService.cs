using Application.Common.Models;
using Application.Common.Time;
using Application.DTOs.Reports;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Reports;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.ProductGroups;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.StockAdjustments;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Returns;
using Domain.Entities.Pos.Shifts;
using Domain.Enums.Inventory.Products;
using Domain.Enums.Inventory.Stock;
using Domain.Enums.Inventory.StockAdjustments;
using Domain.Enums.Pos.Returns;
using Domain.Enums.Pos.Shifts;
using Infrastructure.Implementations.Services.Stock;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Reports;

/// <summary>
/// Tổng quan, báo cáo (FR-01, FR-02, FR-36..FR-38, BR-30, 07 §3.9). Gom theo ngày giờ Việt Nam của <c>PaidAt</c> hóa đơn và
/// <c>CreatedAt</c> phiếu đổi trả; dòng trả trừ vào mặt hàng, nhóm của dòng gốc ở ngày lập phiếu. Số liệu đọc dạng chiếu
/// (vài chục nghìn dòng tối đa) rồi cộng trong bộ nhớ để chạy giống nhau trên mọi provider.
/// </summary>
public sealed class ReportService(
    IGenericRepository<Order> orders,
    IGenericRepository<Return> returns,
    IGenericRepository<Shift> shifts,
    IGenericRepository<Product> products,
    IGenericRepository<ProductGroup> groups,
    IGenericRepository<GoodsReceiptLine> receiptLines,
    IGenericRepository<StockAdjustment> adjustments,
    IGenericRepository<StockAdjustmentLine> adjustmentLines,
    TimeProvider timeProvider) : IReportService
{
    private sealed record LineFact(Guid ProductId, Guid GroupId, decimal Net, decimal Cost, int BaseQty);

    private sealed record OrderFact(Guid Id, DateTime At, decimal Total, Guid CashierId, List<LineFact> Lines, List<(Domain.Enums.Pos.Orders.PaymentMethod Method, decimal Amount)> Payments);

    private sealed record ReturnLineFact(Guid ProductId, Guid GroupId, decimal Refund, decimal Cost, int BaseQty, ReturnCondition Condition, ReturnReason Reason);

    private sealed record ReturnFact(DateTime At, decimal RefundTotal, Guid CashierId, List<ReturnLineFact> Lines);

    public async Task<DashboardDto> GetDashboardAsync(CancellationToken ct = default)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var today = VietnamDates.Today(timeProvider);
        var start7 = VietnamDates.StartOfDayUtc(today.AddDays(-6));
        var (orderFacts, returnFacts) = await LoadAsync(VietnamDates.StartOfDayUtc(today.AddDays(-7)), now, ct);

        var todayStart = VietnamDates.StartOfDayUtc(today);
        var yesterdayStart = VietnamDates.StartOfDayUtc(today.AddDays(-1));
        var sameTime = now.AddDays(-1);

        var todayOrders = orderFacts.Where(o => o.At >= todayStart).ToList();
        var todayReturns = returnFacts.Where(r => r.At >= todayStart).ToList();

        var topProducts = todayOrders.SelectMany(o => o.Lines).Select(l => (l.ProductId, Qty: l.BaseQty, Net: l.Net))
            .Concat(todayReturns.SelectMany(r => r.Lines).Select(l => (l.ProductId, Qty: -l.BaseQty, Net: -l.Refund)))
            .GroupBy(x => x.ProductId)
            .Select(g => (ProductId: g.Key, Qty: g.Sum(x => x.Qty), Net: g.Sum(x => x.Net)))
            .Where(x => x.Qty > 0)
            .OrderByDescending(x => x.Qty).ThenByDescending(x => x.Net)
            .Take(10)
            .ToList();
        var topIds = topProducts.Select(t => t.ProductId).ToList();
        var productInfo = await products.QueryNoTracking().IgnoreQueryFilters().Include(p => p.Units)
            .Where(p => topIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        var active = await products.QueryNoTracking().Where(p => p.Status == ProductStatus.DangBan).Select(p => new { p.Stock, p.MinStock }).ToListAsync(ct);
        var lots = await LotCalculator.AllLotsAsync(products, receiptLines, today, null, ct);

        return new DashboardDto
        {
            AsOf = now,
            Today = Kpi(todayOrders, todayReturns),
            SameTimeYesterday = Kpi(
                orderFacts.Where(o => o.At >= yesterdayStart && o.At <= sameTime).ToList(),
                returnFacts.Where(r => r.At >= yesterdayStart && r.At <= sameTime).ToList()),
            Last7Days = Enumerable.Range(0, 7).Select(i =>
            {
                var day = today.AddDays(i - 6);
                var totals = Totals(orderFacts.Where(o => VietnamDates.DateOf(o.At) == day).ToList(), returnFacts.Where(r => VietnamDates.DateOf(r.At) == day).ToList());
                return new DashboardDay { Date = VietnamDates.Format(day), NetRevenue = totals.NetRevenue, GrossProfit = totals.GrossProfit };
            }).ToList(),
            TopProducts = topProducts.Where(t => productInfo.ContainsKey(t.ProductId)).Select(t =>
            {
                var p = productInfo[t.ProductId];
                return new DashboardTopProduct { ProductId = p.Id, Code = p.Code, Name = p.Name, BaseUnit = p.BaseUnit.Name, Quantity = t.Qty, NetRevenue = t.Net };
            }).ToList(),
            LowStockCount = active.Count(p => StockMath.StatusOf(p.Stock, p.MinStock) != StockStatus.ConHang),
            ExpiringLotCount = lots.Count(l => l.Status == LotStatus.SapHetHan),
            ExpiredLotCount = lots.Count(l => l.Status == LotStatus.DaHetHan)
        };
    }

    public async Task<RevenueReport> GetRevenueAsync(DateRangeQuery query, CancellationToken ct = default)
    {
        var (from, to) = Range(query);
        var length = to.DayNumber - from.DayNumber + 1;
        var prevTo = from.AddDays(-1);
        var prevFrom = prevTo.AddDays(-(length - 1));
        var (orderFacts, returnFacts) = await LoadAsync(VietnamDates.StartOfDayUtc(prevFrom), VietnamDates.EndOfDayExclusiveUtc(to), ct, exclusiveEnd: true);

        List<RevenueDay> Days(DateOnly start, DateOnly end) => Enumerable.Range(0, end.DayNumber - start.DayNumber + 1).Select(i =>
        {
            var day = start.AddDays(i);
            var t = Totals(orderFacts.Where(o => VietnamDates.DateOf(o.At) == day).ToList(), returnFacts.Where(r => VietnamDates.DateOf(r.At) == day).ToList());
            return new RevenueDay
            {
                Date = VietnamDates.Format(day),
                SalesTotal = t.SalesTotal,
                RefundTotal = t.RefundTotal,
                NetRevenue = t.NetRevenue,
                Cogs = t.Cogs,
                GrossProfit = t.GrossProfit,
                MarginPct = t.MarginPct,
                OrderCount = t.OrderCount,
                ReturnCount = t.ReturnCount
            };
        }).ToList();

        var current = Days(from, to);
        var previous = Days(prevFrom, prevTo);
        return new RevenueReport
        {
            From = VietnamDates.Format(from),
            To = VietnamDates.Format(to),
            Days = current,
            Totals = Sum(current),
            Previous = new RevenuePrevious
            {
                From = VietnamDates.Format(prevFrom),
                To = VietnamDates.Format(prevTo),
                Totals = Sum(previous),
                Days = previous.Select(d => new DashboardDay { Date = d.Date, NetRevenue = d.NetRevenue, GrossProfit = d.GrossProfit }).ToList()
            }
        };
    }

    public async Task<GroupProfitReport> GetGroupsAsync(DateRangeQuery query, CancellationToken ct = default)
    {
        var (from, to) = Range(query);
        var (orderFacts, returnFacts) = await LoadRangeAsync(from, to, ct);
        var byGroup = Aggregate(orderFacts, returnFacts, l => l.GroupId, r => r.GroupId);
        var groupList = await groups.QueryNoTracking().OrderBy(g => g.SortOrder).ToListAsync(ct);
        var totalProfit = byGroup.Values.Sum(v => v.Net - v.Cost);

        var rows = groupList.Select(g =>
        {
            var v = byGroup.GetValueOrDefault(g.Id);
            var profit = v.Net - v.Cost;
            return new GroupProfitRow
            {
                GroupId = g.Id,
                GroupName = g.Name,
                Color = g.Color,
                NetRevenue = v.Net,
                Cogs = v.Cost,
                GrossProfit = profit,
                MarginPct = Pct(profit, v.Net),
                ProfitShare = Pct(profit, totalProfit)
            };
        }).OrderByDescending(r => r.GrossProfit).ToList();

        var net = rows.Sum(r => r.NetRevenue);
        var cogs = rows.Sum(r => r.Cogs);
        return new GroupProfitReport
        {
            From = VietnamDates.Format(from),
            To = VietnamDates.Format(to),
            Rows = rows,
            Totals = new ProfitTotals { NetRevenue = net, Cogs = cogs, GrossProfit = net - cogs, MarginPct = Pct(net - cogs, net) }
        };
    }

    public async Task<PaginatedResult<ProductProfitRow>> GetProductsAsync(ProductProfitQuery query, CancellationToken ct = default)
    {
        var (from, to) = Range(query);
        var (orderFacts, returnFacts) = await LoadRangeAsync(from, to, ct);
        var groupFilter = query.GroupId;
        var byProduct = Aggregate(
            orderFacts.Select(o => o with { Lines = o.Lines.Where(l => groupFilter == null || l.GroupId == groupFilter).ToList() }).ToList(),
            returnFacts.Select(r => r with { Lines = r.Lines.Where(l => groupFilter == null || l.GroupId == groupFilter).ToList() }).ToList(),
            l => l.ProductId, r => r.ProductId);

        var ids = byProduct.Keys.ToList();
        var info = await products.QueryNoTracking().IgnoreQueryFilters().Include(p => p.Units).Include(p => p.Group)
            .Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        Func<ProductProfitRow, decimal> key = query.SortBy switch
        {
            "quantity" => r => r.Quantity,
            "netRevenue" => r => r.NetRevenue,
            _ => r => r.GrossProfit
        };
        var rows = byProduct.Where(x => info.ContainsKey(x.Key)).Select(x =>
        {
            var p = info[x.Key];
            var profit = x.Value.Net - x.Value.Cost;
            return new ProductProfitRow
            {
                ProductId = p.Id,
                Code = p.Code,
                Name = p.Name,
                GroupName = p.Group?.Name ?? string.Empty,
                BaseUnit = p.Units.FirstOrDefault(u => u.IsBase)?.Name ?? string.Empty,
                Quantity = x.Value.Qty,
                NetRevenue = x.Value.Net,
                Cogs = x.Value.Cost,
                GrossProfit = profit,
                MarginPct = Pct(profit, x.Value.Net)
            };
        }).OrderByDescending(key).ThenBy(r => r.Code).Select((r, i) => r with { Rank = i + 1 }).ToList();

        var page = Math.Max(1, query.Page);
        var size = Math.Clamp(query.PageSize, 1, PaginationQuery.MaxPageSize);
        return new PaginatedResult<ProductProfitRow>
        {
            Items = rows.Skip((page - 1) * size).Take(size).ToList(),
            Page = page,
            PageSize = size,
            TotalCount = rows.Count
        };
    }

    public async Task<ReturnsReport> GetReturnsAsync(ReturnsReportQuery query, CancellationToken ct = default)
    {
        var (from, to) = Range(query);
        var (_, returnFacts) = await LoadRangeAsync(from, to, ct);
        var lines = returnFacts.SelectMany(r => r.Lines.Select(l => (Return: r, Line: l)))
            .Where(x => query.Reason is null || x.Line.Reason == query.Reason)
            .ToList();

        var defective = lines.Where(x => x.Line.Condition == ReturnCondition.HangLoi).Select(x => x.Line).ToList();
        var defectiveIds = defective.Select(l => l.ProductId).Distinct().ToList();
        var info = await products.QueryNoTracking().IgnoreQueryFilters().Include(p => p.Units)
            .Where(p => defectiveIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        var fromUtc = VietnamDates.StartOfDayUtc(from);
        var toUtc = VietnamDates.EndOfDayExclusiveUtc(to);
        var writeOffRows = await adjustmentLines.QueryNoTracking()
            .Where(l => l.Difference < 0)
            .Join(adjustments.QueryNoTracking().Where(a => a.CreatedAt >= fromUtc && a.CreatedAt < toUtc
                    && (a.Reason == AdjustmentReason.Hong || a.Reason == AdjustmentReason.HetHan || a.Reason == AdjustmentReason.Mat)),
                l => l.StockAdjustmentId, a => a.Id, (l, a) => new { a.Reason, l.Difference, l.Value })
            .ToListAsync(ct);

        return new ReturnsReport
        {
            From = VietnamDates.Format(from),
            To = VietnamDates.Format(to),
            ReturnCount = lines.Select(x => x.Return).Distinct().Count(),
            RefundTotal = lines.Sum(x => x.Line.Refund),
            ByReason = lines.GroupBy(x => x.Line.Reason)
                .Select(g => new ReturnReasonRow { Reason = g.Key, Count = g.Select(x => x.Return).Distinct().Count(), RefundTotal = g.Sum(x => x.Line.Refund) })
                .OrderBy(r => r.Reason).ToList(),
            Defective = new DefectiveSummary
            {
                Quantity = defective.Sum(l => l.BaseQty),
                Value = defective.Sum(l => l.Cost),
                Rows = defective.GroupBy(l => l.ProductId).Where(g => info.ContainsKey(g.Key)).Select(g =>
                {
                    var p = info[g.Key];
                    return new DefectiveRow
                    {
                        ProductId = p.Id,
                        Code = p.Code,
                        Name = p.Name,
                        BaseUnit = p.Units.FirstOrDefault(u => u.IsBase)?.Name ?? string.Empty,
                        Quantity = g.Sum(l => l.BaseQty),
                        Value = g.Sum(l => l.Cost)
                    };
                }).OrderByDescending(r => r.Value).ToList()
            },
            WriteOffs = writeOffRows.GroupBy(w => w.Reason)
                .Select(g => new WriteOffRow { Reason = g.Key, Quantity = g.Sum(w => -w.Difference), Value = g.Sum(w => -w.Value) })
                .OrderBy(w => w.Reason).ToList()
        };
    }

    public async Task<IReadOnlyList<CashierReportRow>> GetCashiersAsync(DateRangeQuery query, CancellationToken ct = default)
    {
        var (from, to) = Range(query);
        var (orderFacts, returnFacts) = await LoadRangeAsync(from, to, ct);
        var fromUtc = VietnamDates.StartOfDayUtc(from);
        var toUtc = VietnamDates.EndOfDayExclusiveUtc(to);
        var shiftRows = await shifts.QueryNoTracking()
            .Where(s => s.OpenedAt >= fromUtc && s.OpenedAt < toUtc)
            .Select(s => new { s.CashierId, s.CashierName, s.Status, s.Difference, s.OpenedAt })
            .ToListAsync(ct);

        var cashierIds = shiftRows.Select(s => s.CashierId).Concat(orderFacts.Select(o => o.CashierId)).Concat(returnFacts.Select(r => r.CashierId)).Distinct();
        var names = await shifts.QueryNoTracking().GroupBy(s => s.CashierId).Select(g => new { g.Key, Name = g.Max(s => s.CashierName) }).ToDictionaryAsync(x => x.Key, x => x.Name, ct);

        return cashierIds.Select(id =>
        {
            var os = orderFacts.Where(o => o.CashierId == id).ToList();
            var rs = returnFacts.Where(r => r.CashierId == id).ToList();
            var ss = shiftRows.Where(s => s.CashierId == id).ToList();
            return new CashierReportRow
            {
                CashierId = id,
                CashierName = names.GetValueOrDefault(id) ?? string.Empty,
                ShiftCount = ss.Count,
                OrderCount = os.Count,
                NetRevenue = os.Sum(o => o.Total) - rs.Sum(r => r.RefundTotal),
                ReturnCount = rs.Count,
                TotalDifference = ss.Where(s => s.Status != ShiftStatus.DangMo).Sum(s => s.Difference ?? 0)
            };
        }).OrderByDescending(r => r.NetRevenue).ToList();
    }

    public async Task<IReadOnlyList<PaymentMethodReportRow>> GetPaymentMethodsAsync(DateRangeQuery query, CancellationToken ct = default)
    {
        var (from, to) = Range(query);
        var (orderFacts, _) = await LoadRangeAsync(from, to, ct);
        var payments = orderFacts.SelectMany(o => o.Payments.Select(p => (Order: o.Id, p.Method, p.Amount))).ToList();
        var total = payments.Sum(p => p.Amount);
        return payments.GroupBy(p => p.Method)
            .Select(g => new PaymentMethodReportRow
            {
                Method = g.Key,
                Amount = g.Sum(p => p.Amount),
                OrderCount = g.Select(p => p.Order).Distinct().Count(),
                Share = Pct(g.Sum(p => p.Amount), total)
            })
            .OrderBy(r => r.Method)
            .ToList();
    }

    private static (DateOnly From, DateOnly To) Range(DateRangeQuery query)
    {
        VietnamDates.TryParse(query.From, out var from);
        VietnamDates.TryParse(query.To, out var to);
        return (from, to);
    }

    private Task<(List<OrderFact>, List<ReturnFact>)> LoadRangeAsync(DateOnly from, DateOnly to, CancellationToken ct) =>
        LoadAsync(VietnamDates.StartOfDayUtc(from), VietnamDates.EndOfDayExclusiveUtc(to), ct, exclusiveEnd: true);

    private async Task<(List<OrderFact>, List<ReturnFact>)> LoadAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct, bool exclusiveEnd = false)
    {
        var orderRows = await orders.QueryNoTracking()
            .Where(o => o.PaidAt >= fromUtc && (exclusiveEnd ? o.PaidAt < toUtc : o.PaidAt <= toUtc))
            .Select(o => new { o.Id, o.PaidAt, o.Total, o.CashierId })
            .ToListAsync(ct);
        var lineRows = await orders.QueryNoTracking()
            .Where(o => o.PaidAt >= fromUtc && (exclusiveEnd ? o.PaidAt < toUtc : o.PaidAt <= toUtc))
            .SelectMany(o => o.Lines.Select(l => new { l.OrderId, l.ProductId, l.GroupId, l.NetAmount, l.CostAmount, l.BaseQty }))
            .ToListAsync(ct);
        var paymentRows = await orders.QueryNoTracking()
            .Where(o => o.PaidAt >= fromUtc && (exclusiveEnd ? o.PaidAt < toUtc : o.PaidAt <= toUtc))
            .SelectMany(o => o.Payments.Select(p => new { p.OrderId, p.Method, p.Amount }))
            .ToListAsync(ct);
        var linesByOrder = lineRows.ToLookup(l => l.OrderId);
        var paymentsByOrder = paymentRows.ToLookup(p => p.OrderId);
        var orderFacts = orderRows.Select(o => new OrderFact(
            o.Id, o.PaidAt, o.Total, o.CashierId,
            linesByOrder[o.Id].Select(l => new LineFact(l.ProductId, l.GroupId, l.NetAmount, l.CostAmount, l.BaseQty)).ToList(),
            paymentsByOrder[o.Id].Select(p => (p.Method, p.Amount)).ToList())).ToList();

        var returnRows = await returns.QueryNoTracking()
            .Where(r => r.CreatedAt >= fromUtc && (exclusiveEnd ? r.CreatedAt < toUtc : r.CreatedAt <= toUtc))
            .Select(r => new { r.Id, r.CreatedAt, r.RefundTotal, r.CashierId })
            .ToListAsync(ct);
        var returnLineRows = await returns.QueryNoTracking()
            .Where(r => r.CreatedAt >= fromUtc && (exclusiveEnd ? r.CreatedAt < toUtc : r.CreatedAt <= toUtc))
            .SelectMany(r => r.Lines.Select(l => new { l.ReturnId, l.ProductId, l.OrderLine!.GroupId, l.RefundAmount, l.CostAmount, l.BaseQty, l.Condition, l.Reason }))
            .ToListAsync(ct);
        var returnLines = returnLineRows.ToLookup(l => l.ReturnId);
        var returnFacts = returnRows.Select(r => new ReturnFact(r.CreatedAt, r.RefundTotal, r.CashierId,
            returnLines[r.Id].Select(l => new ReturnLineFact(l.ProductId, l.GroupId, l.RefundAmount, l.CostAmount, l.BaseQty, l.Condition, l.Reason)).ToList())).ToList();

        return (orderFacts, returnFacts);
    }

    /// <summary>BR-30: bán − hoàn; giá vốn thuần = giá vốn dòng bán − giá vốn dòng trả (mọi tình trạng).</summary>
    private static RevenueTotals Totals(IReadOnlyCollection<OrderFact> orderFacts, IReadOnlyCollection<ReturnFact> returnFacts)
    {
        var sales = orderFacts.Sum(o => o.Total);
        var refunds = returnFacts.Sum(r => r.RefundTotal);
        var cogs = orderFacts.Sum(o => o.Lines.Sum(l => l.Cost)) - returnFacts.Sum(r => r.Lines.Sum(l => l.Cost));
        var net = sales - refunds;
        return new RevenueTotals
        {
            SalesTotal = sales,
            RefundTotal = refunds,
            NetRevenue = net,
            Cogs = cogs,
            GrossProfit = net - cogs,
            MarginPct = Pct(net - cogs, net),
            OrderCount = orderFacts.Count,
            ReturnCount = returnFacts.Count
        };
    }

    private static RevenueTotals Sum(IReadOnlyCollection<RevenueDay> days)
    {
        var net = days.Sum(d => d.NetRevenue);
        var cogs = days.Sum(d => d.Cogs);
        return new RevenueTotals
        {
            SalesTotal = days.Sum(d => d.SalesTotal),
            RefundTotal = days.Sum(d => d.RefundTotal),
            NetRevenue = net,
            Cogs = cogs,
            GrossProfit = net - cogs,
            MarginPct = Pct(net - cogs, net),
            OrderCount = days.Sum(d => d.OrderCount),
            ReturnCount = days.Sum(d => d.ReturnCount)
        };
    }

    private static KpiSet Kpi(IReadOnlyCollection<OrderFact> orderFacts, IReadOnlyCollection<ReturnFact> returnFacts)
    {
        var t = Totals(orderFacts, returnFacts);
        return new KpiSet
        {
            NetRevenue = t.NetRevenue,
            GrossProfit = t.GrossProfit,
            OrderCount = t.OrderCount,
            AvgOrderValue = t.OrderCount == 0 ? 0 : PosRules.RoundVnd(t.SalesTotal / t.OrderCount)
        };
    }

    private static Dictionary<Guid, (decimal Net, decimal Cost, int Qty)> Aggregate(
        IEnumerable<OrderFact> orderFacts,
        IEnumerable<ReturnFact> returnFacts,
        Func<LineFact, Guid> lineKey,
        Func<ReturnLineFact, Guid> returnKey)
    {
        var result = new Dictionary<Guid, (decimal Net, decimal Cost, int Qty)>();
        foreach (var line in orderFacts.SelectMany(o => o.Lines))
        {
            var current = result.GetValueOrDefault(lineKey(line));
            result[lineKey(line)] = (current.Net + line.Net, current.Cost + line.Cost, current.Qty + line.BaseQty);
        }

        foreach (var line in returnFacts.SelectMany(r => r.Lines))
        {
            var current = result.GetValueOrDefault(returnKey(line));
            result[returnKey(line)] = (current.Net - line.Refund, current.Cost - line.Cost, current.Qty - line.BaseQty);
        }

        return result;
    }

    private static decimal Pct(decimal part, decimal whole) => whole == 0 ? 0 : PosRules.Round1Digit(part / whole * 100);
}
