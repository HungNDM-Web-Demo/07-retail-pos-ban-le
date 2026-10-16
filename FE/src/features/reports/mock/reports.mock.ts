import { permissions } from '@/config/permissions'
import { round1, round1dp } from '@/features/pos/lib/pricing'
import { stockStatus } from '@/features/pos/lib/stock-math'
import { addDaysKey, diffDaysKey, vnMinutesOfDay, vnNow, vnStartOfDay, vnTodayKey } from '@/features/pos/lib/vn-time'
import { toShiftDto } from '@/features/pos/mock/mappers'
import { groupById, posDb, productById } from '@/features/pos/mock/pos.db'
import { fieldError } from '@/features/pos/mock/pos.errors'
import { allLots } from '@/features/stock/mock/ledger'
import { mockDelay } from '@/lib/data-source'
import { requirePermission } from '@/mock/mock-auth'
import { paginate } from '@/mock/mock-helpers'
import type { PaginatedResult } from '@/types/api'
import type {
  CashierReportRow,
  DashboardDto,
  DateRangeQuery,
  GroupProfitReport,
  KpiSet,
  PaymentMethod,
  PaymentMethodReportRow,
  ProductProfitQuery,
  ProductProfitRow,
  ReturnReason,
  ReturnsReport,
  RevenueDay,
  RevenueReport,
  RevenueTotals,
} from '@/types/retail-pos'
import { dailyTotals, grossMargin, orderFacts, returnFacts, writeOffFacts, type DayTotals } from './facts'

/** Handler mock `/api/reports/*` (07 §2.10, §3.9; UC-11, UC-15). Quyền `reports.view` (quyết định 2). */

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

function checkRange(q: Partial<DateRangeQuery>): { from: string; to: string } {
  const from = q.from ?? ''
  const to = q.to ?? ''
  if (!DATE.test(from)) throw fieldError({ from: 'Chọn ngày bắt đầu' })
  if (!DATE.test(to)) throw fieldError({ to: 'Chọn ngày kết thúc' })
  if (to < from) throw fieldError({ to: 'Ngày kết thúc phải sau ngày bắt đầu' })
  if (diffDaysKey(from, to) + 1 > 366) throw fieldError({ from: 'Khoảng ngày tối đa 366 ngày' })
  return { from, to }
}

const inRange = (day: string, from: string, to: string) => day >= from && day <= to

function totalsOf(list: DayTotals[]): RevenueTotals {
  const sum = list.reduce(
    (a, d) => ({
      sales: a.sales + d.sales,
      refund: a.refund + d.refund,
      saleCost: a.saleCost + d.saleCost,
      returnCost: a.returnCost + d.returnCost,
      orders: a.orders + d.orders,
      returns: a.returns + d.returns,
    }),
    { sales: 0, refund: 0, saleCost: 0, returnCost: 0, orders: 0, returns: 0 }
  )
  const netRevenue = sum.sales - sum.refund
  const cogs = sum.saleCost - sum.returnCost
  const grossProfit = netRevenue - cogs
  return {
    salesTotal: sum.sales,
    refundTotal: sum.refund,
    netRevenue,
    cogs,
    grossProfit,
    marginPct: grossMargin(grossProfit, netRevenue),
    orderCount: sum.orders,
    returnCount: sum.returns,
  }
}

const EMPTY_DAY: DayTotals = { sales: 0, refund: 0, saleCost: 0, returnCost: 0, orders: 0, returns: 0 }

function daysOf(from: string, to: string): string[] {
  const n = diffDaysKey(from, to)
  return Array.from({ length: n + 1 }, (_, i) => addDaysKey(from, i))
}

/** KPI trong khoảng thời điểm [start, end] (ms) */
function kpiBetween(start: number, end: number): KpiSet {
  let sales = 0
  let refund = 0
  let cost = 0
  let orders = 0
  for (const o of orderFacts())
    if (o.t >= start && o.t <= end) {
      sales += o.total
      cost += o.cost
      orders++
    }
  for (const r of returnFacts())
    if (r.t >= start && r.t <= end) {
      refund += r.refundTotal
      cost -= r.cost
    }
  const netRevenue = sales - refund
  return { netRevenue, grossProfit: netRevenue - cost, orderCount: orders, avgOrderValue: orders ? round1(sales / orders) : 0 }
}

type Agg = { netRevenue: number; cogs: number; quantity: number }
const addAgg = (map: Map<string, Agg>, key: string, net: number, cost: number, qty: number) => {
  const a = map.get(key) ?? { netRevenue: 0, cogs: 0, quantity: 0 }
  a.netRevenue += net
  a.cogs += cost
  a.quantity += qty
  map.set(key, a)
}

/** Gộp theo mặt hàng hoặc nhóm: dòng bán cộng, dòng trả trừ (ngày lập phiếu) */
function aggregate(from: string, to: string, by: 'productId' | 'groupId'): Map<string, Agg> {
  const map = new Map<string, Agg>()
  for (const o of orderFacts()) {
    if (!inRange(o.day, from, to)) continue
    for (const l of o.lines) addAgg(map, l[by], l.net, l.cost, l.baseQty)
  }
  for (const r of returnFacts()) {
    if (!inRange(r.day, from, to)) continue
    for (const l of r.lines) addAgg(map, l[by], -l.net, -l.cost, -l.baseQty)
  }
  return map
}

export const reportsMock = {
  async dashboard(): Promise<DashboardDto> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    const now = vnNow()
    const today = vnTodayKey()
    const yesterday = addDaysKey(today, -1)
    const minutes = vnMinutesOfDay(now)
    const startToday = vnStartOfDay(today)
    const startYesterday = vnStartOfDay(yesterday)
    const daily = dailyTotals()
    const last7Days = daysOf(addDaysKey(today, -6), today).map((date) => {
      const t = totalsOf([daily.get(date) ?? EMPTY_DAY])
      return { date, netRevenue: t.netRevenue, grossProfit: t.grossProfit }
    })
    // Top 10 hôm nay theo số lượng cơ bản bán thuần
    const byProduct = aggregate(today, today, 'productId')
    const topProducts = [...byProduct]
      .filter(([, a]) => a.quantity > 0)
      .sort((a, b) => b[1].quantity - a[1].quantity || b[1].netRevenue - a[1].netRevenue)
      .slice(0, 10)
      .map(([productId, a]) => {
        const p = productById(productId)
        const base = p ? [...p.units].sort((x, y) => x.sortOrder - y.sortOrder)[0] : undefined
        return { productId, code: p?.code ?? '', name: p?.name ?? '', baseUnit: base?.name ?? '', quantity: a.quantity, netRevenue: a.netRevenue }
      })
    const lots = allLots()
    return {
      asOf: new Date(now).toISOString(),
      today: kpiBetween(startToday, now),
      sameTimeYesterday: kpiBetween(startYesterday, startYesterday + minutes * 60_000 + 59_999),
      last7Days,
      topProducts,
      lowStockCount: posDb.products.filter((p) => p.status === 'DangBan' && stockStatus(p.stock, p.minStock) !== 'ConHang').length,
      expiringLotCount: lots.filter((l) => l.status === 'SapHetHan').length,
      expiredLotCount: lots.filter((l) => l.status === 'DaHetHan').length,
    }
  },

  async revenue(query: DateRangeQuery): Promise<RevenueReport> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    const { from, to } = checkRange(query)
    const daily = dailyTotals()
    const days: RevenueDay[] = daysOf(from, to).map((date) => ({ date, ...totalsOf([daily.get(date) ?? EMPTY_DAY]) }))
    const len = days.length
    const prevTo = addDaysKey(from, -1)
    const prevFrom = addDaysKey(from, -len)
    const prevDays = daysOf(prevFrom, prevTo).map((date) => ({ date, t: daily.get(date) ?? EMPTY_DAY }))
    return {
      from,
      to,
      days,
      totals: totalsOf(days.map((d) => daily.get(d.date) ?? EMPTY_DAY)),
      previous: {
        from: prevFrom,
        to: prevTo,
        totals: totalsOf(prevDays.map((d) => d.t)),
        days: prevDays.map((d) => {
          const t = totalsOf([d.t])
          return { date: d.date, netRevenue: t.netRevenue, grossProfit: t.grossProfit }
        }),
      },
    }
  },

  async groups(query: DateRangeQuery): Promise<GroupProfitReport> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    const { from, to } = checkRange(query)
    const agg = aggregate(from, to, 'groupId')
    const groups = posDb.groups.all().sort((a, b) => a.sortOrder - b.sortOrder)
    const totalProfit = [...agg.values()].reduce((s, a) => s + a.netRevenue - a.cogs, 0)
    const rows = groups
      .map((g) => {
        const a = agg.get(g.id) ?? { netRevenue: 0, cogs: 0, quantity: 0 }
        const grossProfit = a.netRevenue - a.cogs
        return {
          groupId: g.id,
          groupName: g.name,
          color: g.color,
          netRevenue: a.netRevenue,
          cogs: a.cogs,
          grossProfit,
          marginPct: grossMargin(grossProfit, a.netRevenue),
          profitShare: totalProfit === 0 ? 0 : round1dp((grossProfit / totalProfit) * 100),
        }
      })
      .sort((a, b) => b.grossProfit - a.grossProfit)
    const net = rows.reduce((s, r) => s + r.netRevenue, 0)
    const cogs = rows.reduce((s, r) => s + r.cogs, 0)
    return { from, to, rows, totals: { netRevenue: net, cogs, grossProfit: net - cogs, marginPct: grossMargin(net - cogs, net) } }
  },

  async products(query: ProductProfitQuery): Promise<PaginatedResult<ProductProfitRow>> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    const { from, to } = checkRange(query)
    const sortBy = query.sortBy ?? 'grossProfit'
    const rows = [...aggregate(from, to, 'productId')]
      .map(([productId, a]) => {
        const p = productById(productId)
        const base = p ? [...p.units].sort((x, y) => x.sortOrder - y.sortOrder)[0] : undefined
        const grossProfit = a.netRevenue - a.cogs
        return {
          rank: 0,
          productId,
          code: p?.code ?? '',
          name: p?.name ?? '',
          groupId: p?.groupId ?? '',
          groupName: p ? (groupById(p.groupId)?.name ?? '') : '',
          baseUnit: base?.name ?? '',
          quantity: a.quantity,
          netRevenue: a.netRevenue,
          cogs: a.cogs,
          grossProfit,
          marginPct: grossMargin(grossProfit, a.netRevenue),
        }
      })
      .filter((r) => !query.groupId || r.groupId === query.groupId)
      .sort((a, b) => b[sortBy] - a[sortBy] || a.code.localeCompare(b.code))
      .map(({ groupId: _g, ...r }, i) => (void _g, { ...r, rank: i + 1 }))
    return paginate(rows, { page: query.page, pageSize: query.pageSize ?? 20 })
  },

  async returns(query: DateRangeQuery & { reason?: ReturnReason }): Promise<ReturnsReport> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    const { from, to } = checkRange(query)
    const list = returnFacts().filter((r) => inRange(r.day, from, to) && (!query.reason || r.lines.some((l) => l.reason === query.reason)))
    const byReason = new Map<ReturnReason, { count: number; refundTotal: number }>()
    const defective = new Map<string, { quantity: number; value: number }>()
    for (const r of list) {
      const seen = new Set<ReturnReason>()
      for (const l of r.lines) {
        if (query.reason && l.reason !== query.reason) continue
        const cur = byReason.get(l.reason) ?? { count: 0, refundTotal: 0 }
        if (!seen.has(l.reason)) cur.count++
        seen.add(l.reason)
        cur.refundTotal += l.net
        byReason.set(l.reason, cur)
        if (l.condition === 'HangLoi') {
          const d = defective.get(l.productId) ?? { quantity: 0, value: 0 }
          d.quantity += l.baseQty
          d.value += l.cost
          defective.set(l.productId, d)
        }
      }
    }
    const defectiveRows = [...defective]
      .map(([productId, d]) => {
        const p = productById(productId)
        const base = p ? [...p.units].sort((x, y) => x.sortOrder - y.sortOrder)[0] : undefined
        return { productId, code: p?.code ?? '', name: p?.name ?? '', baseUnit: base?.name ?? '', ...d }
      })
      .sort((a, b) => b.value - a.value)
    const writeOffs = new Map<string, { quantity: number; value: number }>()
    for (const w of writeOffFacts()) {
      if (!inRange(w.day, from, to)) continue
      const cur = writeOffs.get(w.reason) ?? { quantity: 0, value: 0 }
      cur.quantity += w.quantity
      cur.value += w.value
      writeOffs.set(w.reason, cur)
    }
    return {
      from,
      to,
      returnCount: list.length,
      refundTotal: [...byReason.values()].reduce((s, r) => s + r.refundTotal, 0),
      byReason: [...byReason].map(([reason, v]) => ({ reason, ...v })).sort((a, b) => b.refundTotal - a.refundTotal),
      defective: {
        quantity: defectiveRows.reduce((s, r) => s + r.quantity, 0),
        value: defectiveRows.reduce((s, r) => s + r.value, 0),
        rows: defectiveRows,
      },
      writeOffs: [...writeOffs].map(([reason, v]) => ({ reason: reason as ReturnsReport['writeOffs'][number]['reason'], ...v })),
    }
  },

  async cashiers(query: DateRangeQuery): Promise<CashierReportRow[]> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    const { from, to } = checkRange(query)
    const start = vnStartOfDay(from)
    const end = vnStartOfDay(to) + DAY_MS - 1
    const rows = new Map<string, CashierReportRow>()
    const row = (id: string, name: string) => {
      let r = rows.get(id)
      if (!r) rows.set(id, (r = { cashierId: id, cashierName: name, shiftCount: 0, orderCount: 0, netRevenue: 0, returnCount: 0, totalDifference: 0 }))
      return r
    }
    const names = new Map<string, string>()
    for (const s of posDb.shifts.all()) {
      names.set(s.cashierId, s.cashierName)
      const t = new Date(s.openedAt).getTime()
      if (t < start || t > end) continue
      const r = row(s.cashierId, s.cashierName)
      r.shiftCount++
      if (s.status !== 'DangMo') r.totalDifference += toShiftDto(s).difference ?? 0
    }
    for (const o of orderFacts()) {
      if (!inRange(o.day, from, to)) continue
      const r = row(o.cashierId, names.get(o.cashierId) ?? '')
      r.orderCount++
      r.netRevenue += o.total
    }
    for (const x of returnFacts()) {
      if (!inRange(x.day, from, to)) continue
      const r = row(x.cashierId, names.get(x.cashierId) ?? '')
      r.returnCount++
      r.netRevenue -= x.refundTotal
    }
    return [...rows.values()].sort((a, b) => b.netRevenue - a.netRevenue)
  },

  async paymentMethods(query: DateRangeQuery): Promise<PaymentMethodReportRow[]> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    const { from, to } = checkRange(query)
    const map = new Map<PaymentMethod, { amount: number; orderCount: number }>()
    for (const o of orderFacts()) {
      if (!inRange(o.day, from, to)) continue
      const seen = new Set<PaymentMethod>()
      for (const p of o.payments) {
        const cur = map.get(p.method) ?? { amount: 0, orderCount: 0 }
        cur.amount += p.amount
        if (!seen.has(p.method)) cur.orderCount++
        seen.add(p.method)
        map.set(p.method, cur)
      }
    }
    const total = [...map.values()].reduce((s, v) => s + v.amount, 0)
    const order: PaymentMethod[] = ['TienMat', 'ChuyenKhoan', 'The', 'BuTruDoiHang']
    return order
      .filter((m) => map.has(m))
      .map((m) => ({ method: m, ...map.get(m)!, share: total ? round1dp((map.get(m)!.amount / total) * 100) : 0 }))
  },
}
