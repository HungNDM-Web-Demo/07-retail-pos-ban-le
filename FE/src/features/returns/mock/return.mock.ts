import { permissions } from '@/config/permissions'
import { posRules } from '@/config/pos-rules'
import { mockDelay } from '@/lib/data-source'
import { requirePermission, type MockSessionContext } from '@/mock/mock-auth'
import { mockDb } from '@/mock/mock-db'
import { forbidden, notFound } from '@/mock/mock-errors'
import { newId, paginate, search, sortItems } from '@/mock/mock-helpers'
import { nextDocCode } from '@/features/pos/lib/doc-code'
import { pointsFor, refundForLine, unitNetPrice } from '@/features/pos/lib/pricing'
import { nextAvgCost } from '@/features/pos/lib/stock-math'
import { daysBetweenVn, inVnRange, vnDateKey, vnTodayKey } from '@/features/pos/lib/vn-time'
import { consumeApproval, peekApproval } from '@/features/pos/mock/approvals.mock'
import { canViewCost, hasPermission, readStoreProfile } from '@/features/pos/mock/catalog.mock'
import { lineReturnState, returnStatusOf, toReturnDto, toReturnListItem } from '@/features/pos/mock/mappers'
import { allOrders, allReturns, customerById, orderById, posDb } from '@/features/pos/mock/pos.db'
import { fieldError, posError, PosErrors } from '@/features/pos/mock/pos.errors'
import { canSeeShift, requireOpenShift } from '@/features/shifts/mock/shift.mock'
import {
  deductStock,
  nextOrderCode,
  priceCheckedCart,
  tenderPayment,
  toOrderLines,
} from '@/features/orders/mock/order.mock'
import type { PaginatedResult } from '@/types/api'
import type {
  CreateReturnRequest,
  OrderRecord,
  PaymentDto,
  ReturnDto,
  ReturnListItem,
  ReturnQuery,
  ReturnRecord,
  ReturnSourceListItem,
  ReturnSourceOrder,
  ReturnSourceQuery,
} from '@/types/retail-pos'

/**
 * API `/api/returns` (07 §2.6; UC-07, BR-17…BR-20). Hóa đơn gốc tra không giới hạn "ca của mình", chỉ 30 ngày.
 */

const approvalTextDays = (days: number) => `Hóa đơn ${days} ngày, cần chủ cửa hàng xác nhận`
const BIG_REFUND_TEXT = 'Tiền hoàn trên 500.000 ₫, cần chủ cửa hàng xác nhận'

/** Kiểm hóa đơn gốc đổi trả được: ≤ 30 ngày, chưa trả hết */
function checkSource(order: OrderRecord | undefined, code: string): { order: OrderRecord; days: number } {
  if (!order) throw PosErrors.orderNotFound(code)
  const days = daysBetweenVn(order.paidAt)
  if (days > posRules.maxReturnDays) throw PosErrors.returnExpired()
  if (returnStatusOf(order) === 'TraHet') throw PosErrors.fullyReturned(order.code)
  return { order, days }
}

function toSource(order: OrderRecord, days: number): ReturnSourceOrder {
  const customer = order.customerId ? customerById(order.customerId) : undefined
  const needsApproval = days > posRules.freeReturnDays
  return {
    orderId: order.id,
    code: order.code,
    paidAt: order.paidAt,
    daysSince: days,
    cashierName: order.cashierName,
    total: order.total,
    payments: order.payments,
    customer: customer ? { id: customer.id, phone: customer.phone, name: customer.name } : undefined,
    lines: order.lines.map((l, i) => {
      const state = lineReturnState(l.id)
      return {
        orderLineId: l.id,
        lineNo: i + 1,
        productId: l.productId,
        productName: l.productName,
        unitId: l.unitId,
        unitName: l.unitName,
        factor: l.factor,
        quantity: l.quantity,
        returnedQty: state.returnedQty,
        returnableQty: l.returnable ? l.quantity - state.returnedQty : 0,
        netAmount: l.netAmount,
        refundedAmount: state.refundedAmount,
        unitNetPrice: unitNetPrice(l),
        returnable: l.returnable,
      }
    }),
    needsApproval,
    approvalText: needsApproval ? approvalTextDays(days) : undefined,
  }
}

function scopeFilter(ctx: MockSessionContext) {
  if (hasPermission(ctx, permissions.shifts.view)) return () => true
  const own = new Set(posDb.shifts.filter((s) => s.cashierId === ctx.user.id).map((s) => s.id))
  return (r: ReturnRecord) => own.has(r.shiftId)
}

const findByCode = (code: string) => allOrders().find((o) => o.code === code)

export const returnMock = {
  /** GET /api/returns/source?code= (FR-22) */
  async source(code: string): Promise<ReturnSourceOrder> {
    await mockDelay(150, 300)
    requirePermission(permissions.returns.create)
    const value = (code ?? '').trim().toUpperCase()
    const { order, days } = checkSource(findByCode(value), value)
    return toSource(order, days)
  },

  /** GET /api/returns/source-orders (UC-07 2a: khách mất bill) */
  async sourceOrders(query: ReturnSourceQuery): Promise<PaginatedResult<ReturnSourceListItem>> {
    await mockDelay()
    requirePermission(permissions.returns.create)
    let rows = allOrders().filter(
      (o) =>
        daysBetweenVn(o.paidAt) <= posRules.maxReturnDays &&
        (!query.date || vnDateKey(o.paidAt) === query.date) &&
        (!query.productId || o.lines.some((l) => l.productId === query.productId)) &&
        returnStatusOf(o) !== 'TraHet'
    )
    rows = search(rows, query.search, ['code', 'note'])
    const page = paginate(sortItems(rows, 'paidAt', 'desc'), query)
    return {
      ...page,
      items: page.items.map((o) => ({
        orderId: o.id,
        code: o.code,
        paidAt: o.paidAt,
        total: o.total,
        itemCount: o.lines.reduce((s, l) => s + l.quantity, 0),
        cashierName: o.cashierName,
      })),
    }
  },

  /** POST /api/returns: lập phiếu (kèm hóa đơn đổi hàng nếu có), đúng thứ tự §2.6 */
  async create(input: CreateReturnRequest): Promise<ReturnDto> {
    await mockDelay(150, 300)
    const ctx = requirePermission(permissions.returns.create)
    if (input.clientRequestId) {
      const existing = posDb.returns.find((r) => r.clientRequestId === input.clientRequestId)
      if (existing) return toReturnDto(existing, canViewCost(ctx))
    }
    const shift = requireOpenShift(ctx, true)
    const src = orderById(input.orderId)
    const { order, days } = checkSource(src, src?.code ?? '')
    if (!input.lines?.length) throw fieldError({ lines: 'Chọn ít nhất một mặt hàng để trả' })
    const seen = new Set<string>()
    const refunds = input.lines.map((l, i) => {
      const line = order.lines.find((x) => x.id === l.orderLineId)
      if (!line || seen.has(l.orderLineId)) throw fieldError({ [`lines[${i}].orderLineId`]: 'Dòng không thuộc hóa đơn' })
      seen.add(l.orderLineId)
      if (!line.returnable) throw PosErrors.notReturnable()
      const state = lineReturnState(line.id)
      const max = line.quantity - state.returnedQty
      if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > max) throw PosErrors.overReturn(i, max)
      if (l.reason === 'Khac' && !l.note?.trim()) throw fieldError({ [`lines[${i}].note`]: 'Nhập ghi chú lý do' })
      return { input: l, line, amount: refundForLine({ ...line, ...state }, l.quantity) }
    })
    const refundTotal = refunds.reduce((s, r) => s + r.amount, 0)
    const reasons: string[] = []
    if (days > posRules.freeReturnDays) reasons.push(approvalTextDays(days))
    if (refundTotal > posRules.refundApprovalThreshold) reasons.push(BIG_REFUND_TEXT)
    if (reasons.length) {
      if (!input.approvalToken) {
        throw posError('CanXacNhan', `Cần chủ cửa hàng xác nhận: ${reasons.join('; ')}`, {
          extra: {
            approvalReasons: reasons.map((text) => ({
              code: text === BIG_REFUND_TEXT ? 'HoanLon' : 'QuaHanTra',
              text,
            })),
          },
        })
      }
      if (!peekApproval(input.approvalToken, 'DoiTra')) throw PosErrors.invalidApproval()
    }
    if (input.expectedRefundTotal !== refundTotal) throw PosErrors.totalChanged(refundTotal)

    // Hàng đổi (BR-20): kiểm như thanh toán, không giảm giá
    const exchangeInput = input.exchange?.lines?.length ? input.exchange : undefined
    const exchange = exchangeInput
      ? priceCheckedCart({ lines: exchangeInput.lines.map((l) => ({ ...l })) }, 'exchange.lines', false)
      : undefined
    const exchangeTotal = exchange?.priced.total ?? 0
    let exchangePayment: PaymentDto | undefined
    if (exchange && exchangeInput) {
      if (!readStoreProfile().allowNegativeStock && exchange.overStock.length) throw PosErrors.overStock(exchange.overStock)
      if (exchangeInput.expectedTotal !== exchangeTotal) throw PosErrors.totalChanged(exchangeTotal)
      const difference = exchangeTotal - refundTotal
      if (difference > 0) {
        if (!exchangeInput.payment) throw fieldError({ 'exchange.payment': 'Chọn hình thức thu phần chênh lệch' })
        exchangePayment = tenderPayment(exchangeInput.payment, difference, 'exchange.payment')
      }
    }
    const approval = reasons.length ? consumeApproval(input.approvalToken, 'DoiTra') : undefined

    const now = new Date().toISOString()
    const today = vnTodayKey()
    const returnId = newId()
    const offset = Math.min(refundTotal, exchangeTotal)
    const customer = order.customerId ? customerById(order.customerId) : undefined
    const pointsDeducted = customer ? Math.min(customer.points, pointsFor(refundTotal)) : 0
    let exchangeOrder: OrderRecord | undefined
    if (exchange && exchangeInput) {
      const lines = toOrderLines(exchange, exchangeInput.lines, false)
      const payments: PaymentDto[] = []
      if (offset > 0) payments.push({ method: 'BuTruDoiHang', amount: offset })
      if (exchangePayment) payments.push(exchangePayment)
      exchangeOrder = {
        id: newId(),
        code: nextOrderCode(),
        clientRequestId: null,
        paidAt: now,
        shiftId: shift.id,
        cashierId: ctx.user.id,
        cashierName: ctx.user.fullName,
        lines,
        subtotal: exchange.priced.subtotal,
        orderDiscount: null,
        total: exchangeTotal,
        payments,
        approvedByName: null,
        // Hóa đơn đổi gắn khách của hóa đơn gốc, được cộng điểm (khớp BE)
        customerId: customer?.id ?? null,
        pointsEarned: customer ? pointsFor(exchangeTotal) : 0,
        note: null,
        exchangeForReturnId: returnId,
        qrContent: exchangePayment?.method === 'ChuyenKhoan' ? (exchangeInput.qrContent ?? null) : null,
      }
    }
    const record: ReturnRecord = {
      id: returnId,
      code: nextDocCode(
        'TH',
        4,
        today,
        allReturns().map((r) => r.code)
      ),
      clientRequestId: input.clientRequestId || null,
      createdAt: now,
      shiftId: shift.id,
      cashierId: ctx.user.id,
      cashierName: ctx.user.fullName,
      orderId: order.id,
      lines: refunds.map((r) => ({
        id: newId(),
        orderLineId: r.line.id,
        productId: r.line.productId,
        quantity: r.input.quantity,
        condition: r.input.condition,
        reason: r.input.reason,
        note: r.input.note?.trim() || null,
        refundAmount: r.amount,
      })),
      refundTotal,
      offsetAmount: offset,
      refundMethod: input.refundMethod === 'ChuyenKhoan' ? 'ChuyenKhoan' : 'TienMat',
      exchangeOrderId: exchangeOrder?.id ?? null,
      approvedByName: approval?.username ?? null,
      // Lý do "Khác": ghi chú vào cả phiếu lẫn dòng (khớp BE)
      note: input.note?.trim() || input.lines.find((l) => l.reason === 'Khac' && l.note?.trim())?.note?.trim() || null,
      pointsDeducted,
    }
    mockDb.batch(() => {
      posDb.returns.insert(record)
      // Hàng bán lại được nhập lại theo giá vốn dòng gốc, tính lại bình quân (BR-19, §3.8)
      for (const r of refunds) {
        if (r.input.condition !== 'BanLaiDuoc') continue
        const qIn = r.input.quantity * r.line.factor
        posDb.products.update(r.line.productId, (p) => ({
          ...p,
          avgCost: nextAvgCost(p.stock, p.avgCost, qIn, r.line.unitCost),
          stock: p.stock + qIn,
          updatedAt: now,
        }))
      }
      if (exchangeOrder) {
        posDb.orders.insert(exchangeOrder)
        deductStock(exchangeOrder.lines)
      }
      if (customer) {
        const earned = exchangeOrder?.pointsEarned ?? 0
        posDb.customers.update(customer.id, (c) => ({ ...c, points: Math.max(0, c.points - pointsDeducted + earned) }))
      }
    })
    return toReturnDto(record, canViewCost(ctx))
  },

  /** GET /api/returns, phạm vi "ca của mình" */
  async list(query: ReturnQuery): Promise<PaginatedResult<ReturnListItem>> {
    await mockDelay()
    const ctx = requirePermission(permissions.returns.view)
    const seeAll = hasPermission(ctx, permissions.shifts.view)
    const inScope = scopeFilter(ctx)
    let rows = allReturns().filter(
      (r) =>
        inScope(r) &&
        inVnRange(r.createdAt, query.from, query.to) &&
        (!seeAll || !query.cashierId || r.cashierId === query.cashierId) &&
        (!seeAll || !query.shiftId || r.shiftId === query.shiftId)
    )
    rows = search(rows, query.search, ['code', (r) => orderById(r.orderId)?.code ?? ''])
    const page = paginate(sortItems(rows, query.sortBy || 'createdAt', query.sortDir || 'desc'), query)
    return { ...page, items: page.items.map(toReturnListItem) }
  },

  /** GET /api/returns/{id} */
  async detail(id: string): Promise<ReturnDto> {
    await mockDelay(120, 250)
    const ctx = requirePermission(permissions.returns.view)
    const record = allReturns().find((r) => r.id === id)
    if (!record) throw notFound('Không tìm thấy phiếu đổi trả')
    if (!canSeeShift(ctx, record.shiftId)) throw forbidden()
    return toReturnDto(record, canViewCost(ctx))
  },
}
