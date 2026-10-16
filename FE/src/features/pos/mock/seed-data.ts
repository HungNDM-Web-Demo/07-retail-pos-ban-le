import demoData from '@/mock/seed/demo-data.json'
import { stableId } from '@/mock/mock-helpers'
import { systemSeed } from '@/mock/system-seed'
import type {
  AdjustmentReason,
  DiscountDto,
  DiscountReason,
  DiscountType,
  GoodsReceiptRecord,
  GoodsReceiptStatus,
  OrderLineRecord,
  OrderRecord,
  PaymentDto,
  ProductGroupRecord,
  ProductRecord,
  RefundMethod,
  ReturnCondition,
  ReturnReason,
  ReturnRecord,
  ShiftRecord,
  StockAdjustmentRecord,
  SupplierRecord,
  CustomerRecord,
  TenderMethod,
} from '@/types/retail-pos'
import { discountAmount, floor500, pointsFor, priceCart, type PricingUnit } from '../lib/pricing'
import { docCode } from '../lib/doc-code'
import { addDaysKey, vnAt, vnMinutesOfDay, vnNow, vnTodayKey } from '../lib/vn-time'
import { posRules } from '@/config/pos-rules'

/**
 * Đọc `demo-data.json` và suy ra bản ghi đúng 06 §5.2–5.3 (dùng chung cho `history.ts` và `pos.db.ts`).
 * Ngày tương đối tính theo giờ Việt Nam lúc nạp; hóa đơn, ca hôm nay chỉ nạp phần có giờ ≤ hiện tại.
 *
 * Id (`stableId` của mock-helpers, khớp BE `SeedIds.Stable`): nhóm `('group', code)`, hàng `('product', code)`,
 * đơn vị `('unit', code, k)`, NCC `('supplier', code)`, khách `('customer', phone)`, ca `('shift', d, k)`,
 * phiếu nhập `('receipt', i)` + dòng `('receiptLine', i, j)`, điều chỉnh `('adjustment', i)`,
 * hóa đơn `('order', i)` + dòng `('orderLine', i, j)`, phiếu đổi trả `('return', i)` + dòng `('returnLine', i, j)`.
 */

// ───────────────────────── Kiểu thô trong file ─────────────────────────

type RawDiscount = { ty: DiscountType; v: number; r: DiscountReason; n?: string }
type RawProduct = {
  code: string
  name: string
  group: string
  unit: string
  barcode: string | null
  price: number
  cost: number
  minStock: number
  trackExpiry: boolean
  returnable: boolean
  active: boolean
  image: string | null
  color: string
  units: { name: string; factor: number; barcode: string | null; price: number }[]
  openingStock: number
  stock: number
}
type RawOrderItem = [number, number, number, RawDiscount?]
type RawOrder = {
  d: number
  t: string
  k: number
  pm?: TenderMethod
  cash?: number
  it: RawOrderItem[]
  dc?: RawDiscount
  by?: string
  cu?: string
  n?: string
  rx?: number
}
type RawReturn = {
  d: number
  t: string
  k: number
  o: number
  li: [number, number, ReturnCondition, ReturnReason][]
  rm: RefundMethod
  x?: number
  by?: string
  n?: string
}
type RawShift = {
  d: number
  k: number
  c: string
  o: string
  x: string
  oc: number
  df: number
  n?: string
  rv?: { n: string; by: string }
}
type RawReceipt = {
  d: number
  t: string
  s: string
  st: GoodsReceiptStatus
  n?: string
  li: [number, number, number, (number | null)?, (number | null)?][]
}
type RawAdjustment = { d: number; t: string; r: AdjustmentReason; n?: string; li: [number, number][] }

export type RawSeed = {
  productGroups: { code: string; name: string; color: string; sortOrder: number }[]
  products: RawProduct[]
  suppliers: { code: string; name: string; phone?: string; address?: string; note?: string }[]
  customers: { phone: string; name: string; createdDaysAgo: number }[]
  receipts: RawReceipt[]
  adjustments: RawAdjustment[]
  shifts: RawShift[]
  orders: RawOrder[]
  returns: RawReturn[]
}

export const rawSeed = demoData as unknown as RawSeed

// ───────────────────────── Kết quả ─────────────────────────

export type SeedResult = {
  todayKey: string
  groups: ProductGroupRecord[]
  products: ProductRecord[]
  suppliers: SupplierRecord[]
  customers: CustomerRecord[]
  shifts: ShiftRecord[]
  /** Hóa đơn trước hôm nay (lịch sử chỉ đọc) */
  historyOrders: OrderRecord[]
  /** Hóa đơn hôm nay có giờ ≤ lúc nạp */
  todayOrders: OrderRecord[]
  returns: ReturnRecord[]
  historyReceipts: GoodsReceiptRecord[]
  draftReceipts: GoodsReceiptRecord[]
  historyAdjustments: StockAdjustmentRecord[]
}

const productCode = (no: number) => `SP${String(no).padStart(5, '0')}`
export const groupIdOf = (code: string) => stableId('group', code)
export const productIdOf = (code: string) => stableId('product', code)
export const unitIdOf = (code: string, k: number) => stableId('unit', code, k)
export const shiftIdOf = (d: number, k: number) => stableId('shift', d, k)
export const seedUserIdOf = (username: string) => stableId('user', username)

const toDiscount = (raw: RawDiscount | undefined, base: number): DiscountDto | null =>
  raw
    ? {
        type: raw.ty,
        value: raw.v,
        amount: discountAmount(base, { type: raw.ty, value: raw.v }),
        reason: raw.r,
        ...(raw.n ? { note: raw.n } : {}),
      }
    : null

function fullNameOf(username: string): string {
  return systemSeed.users.find((u) => u.username === username)?.fullName ?? username
}

/** Dựng toàn bộ bản ghi từ seed theo hôm nay (giờ Việt Nam) và giờ hiện tại. */
export function buildSeed(nowMs: number = vnNow()): SeedResult {
  const todayKey = vnTodayKey()
  const nowMinutes = vnMinutesOfDay(nowMs)
  const dayKey = (d: number) => addDaysKey(todayKey, d)
  const at = (d: number, t: string) => new Date(vnAt(dayKey(d), t)).toISOString()
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  const createdAtBase = at(-120, '08:00')

  // Nhóm hàng, hàng hóa
  const groups: ProductGroupRecord[] = rawSeed.productGroups.map((g) => ({
    id: groupIdOf(g.code),
    code: g.code,
    name: g.name,
    color: g.color,
    sortOrder: g.sortOrder,
    isHidden: false,
    createdAt: createdAtBase,
  }))
  const P = (no: number) => rawSeed.products[no - 1]
  const unitOf = (p: RawProduct, u: number) =>
    u === 0 ? { name: p.unit, factor: 1, price: p.price } : p.units[u - 1]

  const products: ProductRecord[] = rawSeed.products.map((p) => ({
    id: productIdOf(p.code),
    code: p.code,
    name: p.name,
    groupId: groupIdOf(p.group),
    units: [
      { id: unitIdOf(p.code, 0), name: p.unit, factor: 1, barcode: p.barcode, price: p.price, sortOrder: 0 },
      ...p.units.map((u, i) => ({
        id: unitIdOf(p.code, i + 1),
        name: u.name,
        factor: u.factor,
        barcode: u.barcode,
        price: u.price,
        sortOrder: i + 1,
      })),
    ],
    avgCost: p.cost,
    stock: p.stock,
    minStock: p.minStock,
    trackExpiry: p.trackExpiry,
    returnable: p.returnable,
    status: p.active ? 'DangBan' : 'NgungBan',
    imageUrl: p.image ? `/seed/products/${p.image}.webp` : null,
    color: p.color,
    openingStock: p.openingStock,
    createdAt: createdAtBase,
    updatedAt: null,
  }))

  const suppliers: SupplierRecord[] = rawSeed.suppliers.map((s) => ({
    id: stableId('supplier', s.code),
    code: s.code,
    name: s.name,
    phone: s.phone ?? null,
    address: s.address ?? null,
    note: s.note ?? null,
    createdAt: createdAtBase,
  }))

  // Ca: hôm nay bỏ ca chưa mở, ca chưa tới giờ chốt nạp ở trạng thái Đang mở
  const shiftRaw = new Map<string, RawShift>()
  for (const s of rawSeed.shifts) {
    if (s.d === 0 && toMin(s.o) > nowMinutes) continue
    shiftRaw.set(`${s.d}:${s.k}`, s)
  }

  // Tính tiền mọi hóa đơn (giá trong file, giá vốn = cost)
  const priced = rawSeed.orders.map((o) => {
    const lines = o.it.map(([p, u, q, ld]) => ({ productId: String(p), unitId: String(u), quantity: q, ld }))
    const lookup = (pid: string, uid: string): PricingUnit => {
      const prod = P(Number(pid))
      const unit = unitOf(prod, Number(uid))
      return { productName: prod.name, unitName: unit.name, factor: unit.factor, price: unit.price }
    }
    return priceCart(
      lines.map((l) => ({
        productId: l.productId,
        unitId: l.unitId,
        quantity: l.quantity,
        discount: l.ld ? { type: l.ld.ty, value: l.ld.v, reason: l.ld.r } : undefined,
      })),
      lookup,
      o.dc ? { type: o.dc.ty, value: o.dc.v } : null
    )
  })

  // Tiền hoàn từng phiếu đổi trả (BR-18), theo thứ tự phiếu
  const returnedState = new Map<string, { qty: number; refunded: number }>()
  const refunds = rawSeed.returns.map((r) => {
    const src = rawSeed.orders[r.o]
    return r.li.map(([li, q]) => {
      const key = `${r.o}:${li}`
      const state = returnedState.get(key) ?? { qty: 0, refunded: 0 }
      const line = priced[r.o].lines[li]
      const quantity = src.it[li][2]
      const amount =
        state.qty + q >= quantity ? line.netAmount - state.refunded : floor500((line.netAmount * q) / quantity)
      returnedState.set(key, { qty: state.qty + q, refunded: state.refunded + amount })
      return amount
    })
  })
  const refundTotalOf = (ri: number) => refunds[ri].reduce((s, x) => s + x, 0)

  // Hóa đơn
  const orderCodeSeq = new Map<number, number>()
  const historyOrders: OrderRecord[] = []
  const todayOrders: OrderRecord[] = []
  const orderIds: string[] = []
  const customerIdOf = (phone: string) => stableId('customer', phone)
  rawSeed.orders.forEach((o, index) => {
    const id = stableId('order', index)
    orderIds[index] = id
    if (o.d === 0 && toMin(o.t) > nowMinutes) return
    const seq = (orderCodeSeq.get(o.d) ?? 0) + 1
    orderCodeSeq.set(o.d, seq)
    const code = docCode('HD', 4, dayKey(o.d), seq)
    const pr = priced[index]
    const shift = shiftRaw.get(`${o.d}:${o.k}`)
    const cashier = shift?.c ?? 'thungan'
    const lines: OrderLineRecord[] = o.it.map(([p, u, q, ld], li) => {
      const prod = P(p)
      const unit = unitOf(prod, u)
      const pl = pr.lines[li]
      return {
        id: stableId('orderLine', index, li),
        productId: productIdOf(prod.code),
        productCode: prod.code,
        productName: prod.name,
        groupId: groupIdOf(prod.group),
        unitId: unitIdOf(prod.code, u),
        unitName: unit.name,
        factor: unit.factor,
        quantity: q,
        unitPrice: unit.price,
        discount: toDiscount(ld, pl.amount),
        allocatedDiscount: pl.allocatedDiscount,
        netAmount: pl.netAmount,
        unitCost: prod.cost,
        returnable: prod.returnable,
      }
    })
    const payments: PaymentDto[] = []
    let due = pr.total
    if (o.rx !== undefined) {
      const offset = Math.min(refundTotalOf(o.rx), pr.total)
      if (offset > 0) payments.push({ method: 'BuTruDoiHang', amount: offset })
      due = pr.total - offset
    }
    if (due > 0 || payments.length === 0) {
      const method = o.pm ?? 'TienMat'
      const payment: PaymentDto = { method, amount: due }
      if (method === 'TienMat') {
        const cash = o.cash ?? due
        payment.cashReceived = cash
        payment.changeAmount = cash - due
      }
      payments.push(payment)
    }
    const afterLine = pr.subtotal - pr.lineDiscountTotal
    const record: OrderRecord = {
      id,
      code,
      clientRequestId: null,
      paidAt: at(o.d, o.t),
      shiftId: shiftIdOf(o.d, o.k),
      cashierId: seedUserIdOf(cashier),
      cashierName: fullNameOf(cashier),
      lines,
      subtotal: pr.subtotal,
      orderDiscount: toDiscount(o.dc, afterLine),
      total: pr.total,
      payments,
      approvedByName: o.by ?? null,
      customerId: o.cu ? customerIdOf(o.cu) : null,
      pointsEarned: o.cu ? pointsFor(pr.total) : 0,
      note: o.n ?? null,
      exchangeForReturnId: o.rx !== undefined ? stableId('return', o.rx) : null,
      qrContent: null,
    }
    if (o.d < 0) historyOrders.push(record)
    else todayOrders.push(record)
  })

  // Phiếu đổi trả
  const returnCodeSeq = new Map<number, number>()
  const returns: ReturnRecord[] = rawSeed.returns.map((r, index) => {
    const seq = (returnCodeSeq.get(r.d) ?? 0) + 1
    returnCodeSeq.set(r.d, seq)
    const src = rawSeed.orders[r.o]
    const shift = shiftRaw.get(`${r.d}:${r.k}`)
    const cashier = shift?.c ?? 'thungan'
    const refundTotal = refundTotalOf(index)
    const exchangeTotal = r.x !== undefined ? priced[r.x].total : 0
    return {
      id: stableId('return', index),
      code: docCode('TH', 4, dayKey(r.d), seq),
      clientRequestId: null,
      createdAt: at(r.d, r.t),
      shiftId: shiftIdOf(r.d, r.k),
      cashierId: seedUserIdOf(cashier),
      cashierName: fullNameOf(cashier),
      orderId: orderIds[r.o],
      lines: r.li.map(([li, q, condition, reason], j) => ({
        id: stableId('returnLine', index, j),
        orderLineId: stableId('orderLine', r.o, li),
        productId: productIdOf(P(src.it[li][0]).code),
        quantity: q,
        condition,
        reason,
        note: reason === 'Khac' ? (r.n ?? null) : null,
        refundAmount: refunds[index][j],
      })),
      refundTotal,
      offsetAmount: r.x !== undefined ? Math.min(refundTotal, exchangeTotal) : 0,
      refundMethod: r.rm,
      exchangeOrderId: r.x !== undefined ? orderIds[r.x] : null,
      approvedByName: r.by ?? null,
      note: r.n ?? null,
      pointsDeducted: src.cu ? pointsFor(refundTotal) : 0,
    }
  })

  // Ca: tổng hợp tiền mặt để suy ra tiền đếm (BR-21, BR-22)
  const allOrders = [...historyOrders, ...todayOrders]
  const cashIn = new Map<string, number>()
  for (const o of allOrders) {
    const cash = o.payments.filter((p) => p.method === 'TienMat').reduce((s, p) => s + p.amount, 0)
    cashIn.set(o.shiftId, (cashIn.get(o.shiftId) ?? 0) + cash)
  }
  const cashOut = new Map<string, number>()
  for (const r of returns) {
    if (r.refundMethod !== 'TienMat') continue
    cashOut.set(r.shiftId, (cashOut.get(r.shiftId) ?? 0) + (r.refundTotal - r.offsetAmount))
  }
  const shifts: ShiftRecord[] = [...shiftRaw.values()].map((s) => {
    const id = shiftIdOf(s.d, s.k)
    const open = s.d === 0 && toMin(s.x) > nowMinutes
    const expected = s.oc + (cashIn.get(id) ?? 0) - (cashOut.get(id) ?? 0)
    const status = open
      ? 'DangMo'
      : s.rv
        ? 'DaKiemTra'
        : Math.abs(s.df) > posRules.shiftDifferenceThreshold
          ? 'CanKiemTra'
          : 'DaChot'
    return {
      id,
      code: docCode('CA', 2, dayKey(s.d), s.k),
      cashierId: seedUserIdOf(s.c),
      cashierUsername: s.c,
      cashierName: fullNameOf(s.c),
      openedAt: at(s.d, s.o),
      closedAt: open ? null : at(s.d, s.x),
      openingCash: s.oc,
      countedCash: open ? null : expected + s.df,
      cashCount: null,
      status,
      note: s.n ?? null,
      reviewNote: s.rv?.n ?? null,
      reviewedByName: s.rv?.by ?? null,
      reviewedAt: s.rv ? at(s.d + 1, '08:00') : null,
    }
  })

  // Tồn lúc nạp = tồn cuối hôm qua − hàng đã bán của hóa đơn hôm nay đã nạp
  const soldToday = new Map<string, number>()
  for (const o of todayOrders) {
    for (const l of o.lines) soldToday.set(l.productId, (soldToday.get(l.productId) ?? 0) + l.quantity * l.factor)
  }
  for (const p of products) p.stock -= soldToday.get(p.id) ?? 0

  // Khách hàng: điểm từ hóa đơn đã nạp, trừ điểm phiếu trả (BR-31)
  const points = new Map<string, number>()
  for (const o of allOrders) {
    if (o.customerId) points.set(o.customerId, (points.get(o.customerId) ?? 0) + o.pointsEarned)
  }
  const orderById = new Map(allOrders.map((o) => [o.id, o]))
  for (const r of returns) {
    const cid = orderById.get(r.orderId)?.customerId
    if (cid) points.set(cid, (points.get(cid) ?? 0) - r.pointsDeducted)
  }
  const customers: CustomerRecord[] = rawSeed.customers.map((c) => {
    const id = customerIdOf(c.phone)
    return {
      id,
      phone: c.phone,
      name: c.name,
      points: Math.max(0, points.get(id) ?? 0),
      createdAt: at(-c.createdDaysAgo, '09:00'),
    }
  })

  // Phiếu nhập
  const receiptSeq = new Map<number, number>()
  const historyReceipts: GoodsReceiptRecord[] = []
  const draftReceipts: GoodsReceiptRecord[] = []
  rawSeed.receipts.forEach((r, index) => {
    const seq = (receiptSeq.get(r.d) ?? 0) + 1
    receiptSeq.set(r.d, seq)
    const confirmed = r.st === 'DaNhapKho'
    const record: GoodsReceiptRecord = {
      id: stableId('receipt', index),
      code: docCode('PN', 3, dayKey(r.d), seq),
      supplierId: stableId('supplier', r.s),
      status: r.st,
      receivedDate: dayKey(r.d),
      confirmedAt: confirmed ? at(r.d, r.t) : null,
      createdBy: 'quanly',
      note: r.n ?? null,
      lines: r.li.map(([p, u, q, price, hsd], j) => {
        const prod = P(p)
        const unit = unitOf(prod, u)
        return {
          id: stableId('receiptLine', index, j),
          productId: productIdOf(prod.code),
          unitId: unitIdOf(prod.code, u),
          unitName: unit.name,
          factor: unit.factor,
          quantity: q,
          unitPrice: price ?? prod.cost * unit.factor,
          expiryDate: hsd !== undefined && hsd !== null ? dayKey(hsd) : null,
          costBefore: confirmed ? prod.cost : null,
          costAfter: confirmed ? prod.cost : null,
        }
      }),
      createdAt: at(r.d, r.t),
    }
    if (confirmed) historyReceipts.push(record)
    else draftReceipts.push(record)
  })

  // Phiếu điều chỉnh: tồn hệ thống = tồn chạy lại tới trước phiếu (06 §5.4)
  const adjustments = buildAdjustments(rawSeed, at, dayKey, productCode)

  return {
    todayKey,
    groups,
    products,
    suppliers,
    customers,
    shifts,
    historyOrders,
    todayOrders,
    returns,
    historyReceipts,
    draftReceipts,
    historyAdjustments: adjustments,
  }
}

/** Tồn hệ thống lúc lập từng phiếu điều chỉnh mẫu: tồn đầu + nhập − bán + trả bán lại được ± điều chỉnh trước đó. */
function buildAdjustments(
  seed: RawSeed,
  at: (d: number, t: string) => string,
  dayKey: (d: number) => string,
  productCode: (no: number) => string
): StockAdjustmentRecord[] {
  const P = (no: number) => seed.products[no - 1]
  const factorOf = (no: number, u: number) => (u === 0 ? 1 : P(no).units[u - 1].factor)
  const time = (d: number, t: string) => vnAt(dayKey(d), t)
  const watched = new Set(seed.adjustments.flatMap((a) => a.li.map(([p]) => p)))
  type Ev = { at: number; type: number; qty: number; p: number }
  const events: Ev[] = []
  for (const r of seed.receipts) {
    if (r.st !== 'DaNhapKho') continue
    for (const [p, u, q] of r.li) if (watched.has(p)) events.push({ at: time(r.d, r.t), type: 0, qty: q * factorOf(p, u), p })
  }
  for (const o of seed.orders) {
    if (o.d >= 0) continue
    for (const [p, u, q] of o.it) if (watched.has(p)) events.push({ at: time(o.d, o.t), type: 1, qty: -q * factorOf(p, u), p })
  }
  for (const r of seed.returns) {
    const src = seed.orders[r.o]
    for (const [li, q, cond] of r.li) {
      const [p, u] = src.it[li]
      if (cond === 'BanLaiDuoc' && watched.has(p)) events.push({ at: time(r.d, r.t), type: 2, qty: q * factorOf(p, u), p })
    }
  }
  const seq = new Map<number, number>()
  const applied: { at: number; p: number; diff: number }[] = []
  return seed.adjustments.map((a, index) => {
    const s = (seq.get(a.d) ?? 0) + 1
    seq.set(a.d, s)
    const tAdj = time(a.d, a.t)
    const lines = a.li.map(([p, diff]) => {
      const base =
        P(p).openingStock +
        events.filter((e) => e.p === p && e.at <= tAdj).reduce((sum, e) => sum + e.qty, 0) +
        applied.filter((x) => x.p === p).reduce((sum, x) => sum + x.diff, 0)
      return { productId: productIdOf(productCode(p)), systemQty: base, actualQty: base + diff, unitCost: P(p).cost }
    })
    a.li.forEach(([p, diff]) => applied.push({ at: tAdj, p, diff }))
    return {
      id: stableId('adjustment', index),
      code: docCode('DC', 3, dayKey(a.d), s),
      createdAt: at(a.d, a.t),
      createdBy: 'quanly',
      reason: a.r,
      note: a.n ?? null,
      goodsReceiptLineId: null,
      lines,
    }
  })
}
