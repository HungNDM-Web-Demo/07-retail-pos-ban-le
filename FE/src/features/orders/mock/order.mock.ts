import { permissions } from '@/config/permissions'
import { posRules } from '@/config/pos-rules'
import { mockDelay } from '@/lib/data-source'
import { requirePermission, type MockSessionContext } from '@/mock/mock-auth'
import { mockDb } from '@/mock/mock-db'
import { forbidden, notFound } from '@/mock/mock-errors'
import { newId, paginate, search, sortItems } from '@/mock/mock-helpers'
import { nextDocCode } from '@/features/pos/lib/doc-code'
import { approvalReasons, discountExceeds, pointsFor, priceCart, type PricedCart } from '@/features/pos/lib/pricing'
import { inVnRange, vnTodayKey } from '@/features/pos/lib/vn-time'
import { peekApproval, consumeApproval } from '@/features/pos/mock/approvals.mock'
import { canViewCost, hasPermission, readStoreProfile } from '@/features/pos/mock/catalog.mock'
import { returnStatusOf, toOrderDto, toOrderListItem } from '@/features/pos/mock/mappers'
import { allOrders, customerById, orderById, posDb, productById } from '@/features/pos/mock/pos.db'
import { fieldError, PosErrors } from '@/features/pos/mock/pos.errors'
import { canSeeShift, requireOpenShift } from '@/features/shifts/mock/shift.mock'
import type { PaginatedResult } from '@/types/api'
import type {
  CartInput,
  CartLineInput,
  CheckoutRequest,
  DiscountInput,
  NextCodeDto,
  OrderDto,
  OrderLineRecord,
  OrderListItem,
  OrderQuery,
  OrderQuote,
  OrderRecord,
  OverStockLine,
  PaymentDto,
  ProductRecord,
  TenderInput,
} from '@/types/retail-pos'

/**
 * API `/api/orders` (07 §2.4; UC-03…UC-06, UC-08): quote, thanh toán, tra cứu, mã kế tiếp.
 * Công thức tiền ở `features/pos/lib/pricing.ts` (§3), câu lỗi đúng §2.12.
 */

// ───────────────────────── Kiểm tra, tính tiền giỏ (dùng chung với đổi hàng) ─────────────────────────

export type CheckedCart = {
  priced: PricedCart
  products: ProductRecord[] // theo thứ tự dòng
  expectedCost: number
  overStock: OverStockLine[]
}

const unitOf = (p: ProductRecord, unitId: string) => p.units.find((u) => u.id === unitId)

/** §2.4 bước 3: dòng tồn tại, đang bán, đơn vị thuộc hàng, số lượng 1–9.999. `key` là tiền tố khóa lỗi. */
export function checkCart(lines: CartLineInput[] | undefined, key = 'lines'): ProductRecord[] {
  if (!lines?.length) throw PosErrors.emptyCart()
  const products = lines.map((line, i) => {
    const p = productById(line.productId)
    if (!p) throw PosErrors.badUnit()
    if (p.status !== 'DangBan') throw PosErrors.inactive(p.name, i, key)
    if (!unitOf(p, line.unitId)) throw PosErrors.badUnit()
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > posRules.maxLineQuantity) {
      throw PosErrors.badQty(i, key)
    }
    return p
  })
  return products
}

const lookup = (productId: string, unitId: string) => {
  const p = productById(productId)
  const u = p ? unitOf(p, unitId) : undefined
  return p && u ? { productName: p.name, unitName: u.name, factor: u.factor, price: u.price } : undefined
}

function checkDiscount(d: DiscountInput | undefined, key: string) {
  if (!d) return
  if (!Number.isFinite(d.value) || d.value < 0) throw fieldError({ [`${key}.value`]: 'Mức giảm không hợp lệ' })
  if (d.type === 'PhanTram' && d.value > 100) throw fieldError({ [`${key}.value`]: 'Phần trăm giảm từ 0 đến 100' })
  if (d.type === 'SoTien' && d.value % posRules.priceStep !== 0) {
    throw fieldError({ [`${key}.value`]: 'Số tiền giảm là bội số của 500 ₫' })
  }
  if (d.reason === 'Khac' && !d.note?.trim()) throw fieldError({ [`${key}.note`]: 'Nhập ghi chú lý do giảm giá' })
}

/** Kiểm tra và tính tiền giỏ (§2.4 bước 3–5, §3.1–3.4); `withDiscount = false` cho hàng đổi (quyết định 13) */
export function priceCheckedCart(input: CartInput, key = 'lines', withDiscount = true): CheckedCart {
  const products = checkCart(input.lines, key)
  const lines = input.lines.map((l) => (withDiscount ? l : { ...l, discount: undefined }))
  if (withDiscount) {
    lines.forEach((l, i) => {
      checkDiscount(l.discount, `${key}[${i}].discount`)
      const base = (lookup(l.productId, l.unitId)?.price ?? 0) * l.quantity
      if (discountExceeds(base, l.discount)) throw PosErrors.discountTooLarge(`${key}[${i}].discount.value`)
    })
    checkDiscount(input.orderDiscount, 'orderDiscount')
  }
  const orderDiscount = withDiscount ? input.orderDiscount : undefined
  const priced = priceCart(lines, lookup, orderDiscount)
  if (orderDiscount && discountExceeds(priced.subtotal - priced.lineDiscountTotal, orderDiscount)) {
    throw PosErrors.discountTooLarge('orderDiscount.value')
  }
  let expectedCost = 0
  const need = new Map<string, number>()
  priced.lines.forEach((l, i) => {
    expectedCost += l.baseQty * products[i].avgCost
    need.set(l.productId, (need.get(l.productId) ?? 0) + l.baseQty)
  })
  const overStock: OverStockLine[] = []
  for (const [productId, qty] of need) {
    const p = productById(productId)!
    const available = Math.max(p.stock, 0)
    if (qty > available) {
      overStock.push({ productId, productName: p.name, shortage: qty - available, baseUnit: p.units[0].name })
    }
  }
  return { products, priced, expectedCost, overStock }
}

// ───────────────────────── Ghi chứng từ (dùng chung với đổi hàng) ─────────────────────────

/** Dòng hóa đơn chụp giá, giá vốn hiện tại (BR-13) */
export function toOrderLines(checked: CheckedCart, input: CartLineInput[], withDiscount = true): OrderLineRecord[] {
  return checked.priced.lines.map((l, i) => {
    const p = checked.products[i]
    const d = withDiscount ? input[i].discount : undefined
    return {
      id: newId(),
      productId: p.id,
      productCode: p.code,
      productName: p.name,
      groupId: p.groupId,
      unitId: l.unitId,
      unitName: l.unitName,
      factor: l.factor,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: d
        ? { type: d.type, value: d.value, amount: l.discountAmount, reason: d.reason, ...(d.note ? { note: d.note } : {}) }
        : null,
      allocatedDiscount: l.allocatedDiscount,
      netAmount: l.netAmount,
      unitCost: p.avgCost,
      returnable: p.returnable,
    }
  })
}

/** Trừ tồn theo dòng (biến động BanHang suy ra từ hóa đơn) */
export function deductStock(lines: OrderLineRecord[]) {
  const now = new Date().toISOString()
  for (const l of lines) {
    posDb.products.update(l.productId, (p) => ({ ...p, stock: p.stock - l.quantity * l.factor, updatedAt: now }))
  }
}

/** Mã hóa đơn kế tiếp trong ngày (BR-16), xét cả lịch sử và collection */
export function nextOrderCode(): string {
  const today = vnTodayKey()
  const head = `HD${today.slice(2).replace(/-/g, '')}`
  return nextDocCode('HD', 4, today, posDb.orders.filter((o) => o.code.startsWith(head)).map((o) => o.code))
}

/** Khoản thu của một phương thức cho số phải thu `due` (BR-12); tiền mặt kiểm tiền khách đưa */
export function tenderPayment(tender: TenderInput | undefined, due: number, key = 'payment'): PaymentDto {
  const method = tender?.method ?? 'TienMat'
  if (method === 'TienMat') {
    const received = Number(tender?.cashReceived ?? NaN)
    if (!Number.isFinite(received) || received < due) {
      throw PosErrors.notEnoughCash(due - (Number.isFinite(received) ? received : 0), `${key}.cashReceived`)
    }
    return { method, amount: due, cashReceived: received, changeAmount: received - due }
  }
  return { method, amount: due, ...(tender?.reference?.trim() ? { reference: tender.reference.trim() } : {}) }
}

// ───────────────────────── Phạm vi xem ─────────────────────────

function scopeFilter(ctx: MockSessionContext) {
  if (hasPermission(ctx, permissions.shifts.view)) return () => true
  const own = new Set(posDb.shifts.filter((s) => s.cashierId === ctx.user.id).map((s) => s.id))
  return (o: OrderRecord) => own.has(o.shiftId)
}

function viewOrder(ctx: MockSessionContext, order: OrderRecord | undefined, code?: string): OrderDto {
  if (!order) throw code ? PosErrors.orderNotFound(code) : notFound('Không tìm thấy hóa đơn')
  if (!canSeeShift(ctx, order.shiftId)) throw forbidden()
  return toOrderDto(order, canViewCost(ctx))
}

// ───────────────────────── Handler ─────────────────────────

export const orderMock = {
  /** POST /api/orders/quote: tính tiền, lý do cần xác nhận, vượt tồn (không lưu) */
  async quote(input: CartInput): Promise<OrderQuote> {
    await mockDelay(120, 220)
    requirePermission(permissions.orders.create)
    const checked = priceCheckedCart(input)
    const reasons = approvalReasons(checked.priced, checked.expectedCost)
    return {
      ...checked.priced,
      needsApproval: reasons.length > 0,
      approvalReasons: reasons,
      overStock: checked.overStock,
      pointsToEarn: input.customerId ? pointsFor(checked.priced.total) : 0,
    }
  },

  /** POST /api/orders: thanh toán (UC-06), chạy đúng thứ tự §2.4 */
  async checkout(input: CheckoutRequest): Promise<OrderDto> {
    await mockDelay(120, 280)
    const ctx = requirePermission(permissions.orders.create)
    if (input.clientRequestId) {
      const existing = posDb.orders.find((o) => o.clientRequestId === input.clientRequestId)
      if (existing) return toOrderDto(existing, canViewCost(ctx))
    }
    const shift = requireOpenShift(ctx)
    const checked = priceCheckedCart(input)
    const { priced } = checked
    if (!readStoreProfile().allowNegativeStock && checked.overStock.length) throw PosErrors.overStock(checked.overStock)
    const reasons = approvalReasons(priced, checked.expectedCost)
    if (reasons.length) {
      if (!input.approvalToken) throw PosErrors.needApproval(reasons)
      if (!peekApproval(input.approvalToken, 'GiamGia')) throw PosErrors.invalidApproval()
    }
    if (input.expectedTotal !== priced.total) throw PosErrors.totalChanged(priced.total)
    const payment = tenderPayment(input.payment, priced.total)
    const approval = reasons.length ? consumeApproval(input.approvalToken, 'GiamGia') : undefined
    const customer = input.customerId ? customerById(input.customerId) : undefined
    const lines = toOrderLines(checked, input.lines)
    const od = input.orderDiscount
    const record: OrderRecord = {
      id: newId(),
      code: nextOrderCode(),
      clientRequestId: input.clientRequestId || null,
      paidAt: new Date().toISOString(),
      shiftId: shift.id,
      cashierId: ctx.user.id,
      cashierName: ctx.user.fullName,
      lines,
      subtotal: priced.subtotal,
      orderDiscount:
        od && priced.orderDiscountAmount > 0
          ? { type: od.type, value: od.value, amount: priced.orderDiscountAmount, reason: od.reason, ...(od.note ? { note: od.note } : {}) }
          : null,
      total: priced.total,
      payments: [payment],
      approvedByName: approval?.username ?? null,
      customerId: customer?.id ?? null,
      pointsEarned: customer ? pointsFor(priced.total) : 0,
      note: null,
      exchangeForReturnId: null,
      qrContent: input.payment?.method === 'ChuyenKhoan' ? (input.qrContent ?? null) : null,
    }
    mockDb.batch(() => {
      posDb.orders.insert(record)
      deductStock(lines)
      if (customer) posDb.customers.update(customer.id, (c) => ({ ...c, points: c.points + record.pointsEarned }))
    })
    return toOrderDto(record, canViewCost(ctx))
  },

  /** GET /api/orders (FR-21), phạm vi "ca của mình" (07 §1) */
  async list(query: OrderQuery): Promise<PaginatedResult<OrderListItem>> {
    await mockDelay()
    const ctx = requirePermission(permissions.orders.view)
    const seeAll = hasPermission(ctx, permissions.shifts.view)
    const inScope = scopeFilter(ctx)
    let rows = allOrders().filter(
      (o) =>
        inScope(o) &&
        inVnRange(o.paidAt, query.from, query.to) &&
        (!seeAll || !query.cashierId || o.cashierId === query.cashierId) &&
        (!seeAll || !query.shiftId || o.shiftId === query.shiftId) &&
        (!query.paymentMethod || o.payments.some((p) => p.method === query.paymentMethod)) &&
        (!query.customerId || o.customerId === query.customerId)
    )
    if (query.returnStatus) rows = rows.filter((o) => returnStatusOf(o) === query.returnStatus)
    rows = search(rows, query.search, ['code', 'note'])
    const sorted = sortItems(rows, query.sortBy || 'paidAt', query.sortDir || 'desc')
    const page = paginate(sorted, query)
    return { ...page, items: page.items.map(toOrderListItem) }
  },

  /** GET /api/orders/{id} */
  async detail(id: string): Promise<OrderDto> {
    await mockDelay(120, 250)
    const ctx = requirePermission(permissions.orders.view)
    return viewOrder(ctx, orderById(id))
  },

  /** GET /api/orders/by-code/{code}: quét mã trên bill */
  async byCode(code: string): Promise<OrderDto> {
    await mockDelay(120, 250)
    const ctx = requirePermission(permissions.orders.view)
    const value = code.trim().toUpperCase()
    return viewOrder(ctx, allOrders().find((o) => o.code === value), value)
  },

  /** GET /api/orders/next-code: mã dự kiến cho nội dung QR (UC-06 2a) */
  async nextCode(): Promise<NextCodeDto> {
    await mockDelay(60, 120)
    requirePermission(permissions.orders.create)
    return { code: nextOrderCode() }
  },
}
