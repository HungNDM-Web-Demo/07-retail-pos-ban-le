import { round1dp } from '@/features/pos/lib/pricing'
import { vnDateKey } from '@/features/pos/lib/vn-time'
import { allAdjustments, allOrders, allReturns, memoOnChange, orderById, productById } from '@/features/pos/mock/pos.db'
import type { AdjustmentReason, PaymentMethod, ReturnCondition, ReturnReason } from '@/types/retail-pos'

/**
 * Sự kiện doanh thu, giá vốn cho báo cáo (07 §3.9, BR-30) dựng trong bộ nhớ từ mọi hóa đơn, phiếu đổi trả, phiếu
 * điều chỉnh (lịch sử + mock-db). Ngày theo giờ Việt Nam của `paidAt` hóa đơn và `createdAt` phiếu đổi trả.
 * Dòng trả trừ vào mặt hàng của dòng gốc ở ngày lập phiếu. Nhóm hàng là `groupId` chụp trên dòng hóa đơn lúc bán
 * như BE (07 §3.9, §5 quyết định 34); bản ghi thiếu thì lấy nhóm hiện tại.
 */

export type SaleLineFact = { productId: string; groupId: string; baseQty: number; net: number; cost: number }
export type OrderFact = {
  id: string
  t: number
  day: string
  total: number
  cost: number
  cashierId: string
  shiftId: string
  payments: { method: PaymentMethod; amount: number }[]
  lines: SaleLineFact[]
}
export type ReturnLineFact = SaleLineFact & { condition: ReturnCondition; reason: ReturnReason }
export type ReturnFact = {
  id: string
  t: number
  day: string
  refundTotal: number
  cost: number
  cashierId: string
  lines: ReturnLineFact[]
}
export type WriteOffFact = { t: number; day: string; reason: AdjustmentReason; productId: string; quantity: number; value: number }

const groupOf = (productId: string) => productById(productId)?.groupId ?? ''

export const orderFacts = memoOnChange(['orders', 'products'], (): OrderFact[] =>
  allOrders().map((o) => {
    const lines = o.lines.map((l) => {
      const baseQty = l.quantity * l.factor
      return { productId: l.productId, groupId: l.groupId ?? groupOf(l.productId), baseQty, net: l.netAmount, cost: baseQty * l.unitCost }
    })
    const t = new Date(o.paidAt).getTime()
    return {
      id: o.id,
      t,
      day: vnDateKey(t),
      total: o.total,
      cost: lines.reduce((s, l) => s + l.cost, 0),
      cashierId: o.cashierId,
      shiftId: o.shiftId,
      payments: o.payments.map((p) => ({ method: p.method, amount: p.amount })),
      lines,
    }
  })
)

export const returnFacts = memoOnChange(['returns', 'orders', 'products'], (): ReturnFact[] =>
  allReturns().map((r) => {
    const order = orderById(r.orderId)
    const lines = r.lines.map((l) => {
      const src = order?.lines.find((x) => x.id === l.orderLineId)
      const baseQty = l.quantity * (src?.factor ?? 1)
      const productId = src?.productId ?? l.productId
      return {
        productId,
        groupId: src?.groupId ?? groupOf(productId),
        baseQty,
        net: l.refundAmount,
        cost: baseQty * (src?.unitCost ?? 0),
        condition: l.condition,
        reason: l.reason,
      }
    })
    const t = new Date(r.createdAt).getTime()
    return {
      id: r.id,
      t,
      day: vnDateKey(t),
      refundTotal: r.refundTotal,
      cost: lines.reduce((s, l) => s + l.cost, 0),
      cashierId: r.cashierId,
      lines,
    }
  })
)

const WRITE_OFF: AdjustmentReason[] = ['Hong', 'HetHan', 'Mat']

/** Hàng hủy: dòng điều chỉnh giảm với lý do Hỏng, Hết hạn, Mất (giá trị dương) */
export const writeOffFacts = memoOnChange(['adjustments'], (): WriteOffFact[] =>
  allAdjustments().flatMap((a) => {
    if (!WRITE_OFF.includes(a.reason)) return []
    const t = new Date(a.createdAt).getTime()
    return a.lines
      .filter((l) => l.actualQty < l.systemQty)
      .map((l) => {
        const q = l.systemQty - l.actualQty
        return { t, day: vnDateKey(t), reason: a.reason, productId: l.productId, quantity: q, value: q * l.unitCost }
      })
  })
)

export type DayTotals = { sales: number; refund: number; saleCost: number; returnCost: number; orders: number; returns: number }

/** Tổng theo ngày (giờ Việt Nam) */
export const dailyTotals = memoOnChange(['orders', 'returns', 'products'], () => {
  const map = new Map<string, DayTotals>()
  const get = (day: string) => {
    let d = map.get(day)
    if (!d) map.set(day, (d = { sales: 0, refund: 0, saleCost: 0, returnCost: 0, orders: 0, returns: 0 }))
    return d
  }
  for (const o of orderFacts()) {
    const d = get(o.day)
    d.sales += o.total
    d.saleCost += o.cost
    d.orders++
  }
  for (const r of returnFacts()) {
    const d = get(r.day)
    d.refund += r.refundTotal
    d.returnCost += r.cost
    d.returns++
  }
  return map
})

/** Biên lãi gộp % 1 chữ số; 0 khi doanh thu thuần 0 */
export const grossMargin = (gross: number, net: number) => (net === 0 ? 0 : round1dp((gross / net) * 100))
