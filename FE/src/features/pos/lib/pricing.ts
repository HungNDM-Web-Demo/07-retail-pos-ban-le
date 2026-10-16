import { posRules } from '@/config/pos-rules'
import { formatNumber, formatVnd } from '@/lib/format'
import type {
  ApprovalReason,
  CartLineInput,
  DiscountInput,
  OrderQuote,
  QuoteLine,
} from '@/types/retail-pos'

/**
 * Công thức tiền (07 §3.1–3.6; BE `Domain/Entities/Pos/OrderPricing.cs`). Tiền là số nguyên đồng.
 * Dùng chung: giỏ tại máy bán hàng (chưa có giá vốn), mock quote/checkout/đổi trả, nạp seed.
 */

/** Làm tròn xuống tới bội số 500 ₫ (BR-07) */
export const floor500 = (n: number): number => Math.floor(n / posRules.priceStep) * posRules.priceStep

/** Làm tròn tới 1 ₫, nửa lên (C# MidpointRounding.AwayFromZero với số dương) */
export const round1 = (n: number): number => Math.round(n)

/** Làm tròn 1 chữ số thập phân (phần trăm) */
export const round1dp = (n: number): number => Math.round(n * 10) / 10

/** Tiền giảm trên cơ sở `base` (BR-07): phần trăm làm tròn xuống 500 ₫; số tiền không vượt `base`. */
export function discountAmount(base: number, d: Pick<DiscountInput, 'type' | 'value'> | null | undefined): number {
  if (!d || base <= 0) return 0
  if (d.type === 'PhanTram') return floor500((base * d.value) / 100)
  return Math.min(d.value, base)
}

/** Giảm số tiền lớn hơn phần được giảm (UC-05 E1 → `GiamQuaTongTien`) */
export const discountExceeds = (base: number, d: Pick<DiscountInput, 'type' | 'value'> | null | undefined): boolean =>
  !!d && d.type === 'SoTien' && d.value > base

/** Kiểm giá trị giảm nhập vào: phần trăm 0–100 (1 chữ số), số tiền bội số 500. Trả câu lỗi hoặc null. */
export function validateDiscountValue(d: Pick<DiscountInput, 'type' | 'value'>): string | null {
  if (!Number.isFinite(d.value) || d.value <= 0) return 'Nhập mức giảm lớn hơn 0'
  if (d.type === 'PhanTram') {
    if (d.value > 100) return 'Phần trăm giảm từ 0 đến 100'
    if (Math.round(d.value * 10) !== d.value * 10) return 'Phần trăm tối đa 1 chữ số thập phân'
    return null
  }
  if (d.value % posRules.priceStep !== 0) return 'Số tiền giảm là bội số của 500 ₫'
  return null
}

/** Thông tin đơn vị cần để tính tiền một dòng (từ danh mục máy bán hàng hoặc bản ghi hàng hóa) */
export type PricingUnit = {
  productName: string
  unitName: string
  factor: number
  price: number
}
export type UnitLookup = (productId: string, unitId: string) => PricingUnit | undefined

export type PricedCart = Pick<
  OrderQuote,
  'lines' | 'subtotal' | 'lineDiscountTotal' | 'orderDiscountAmount' | 'discountTotal' | 'discountPct' | 'total'
>

/**
 * Tính tiền giỏ (§3.1–3.2): thành tiền, giảm dòng, giảm hóa đơn, phân bổ BR-14 (dòng cuối nhận phần dư).
 * Dòng không tra được đơn vị bị bỏ qua (máy bán hàng: danh mục cũ); handler mock kiểm trước khi gọi.
 */
export function priceCart(
  lines: CartLineInput[],
  unitLookup: UnitLookup,
  orderDiscount?: Pick<DiscountInput, 'type' | 'value'> | null
): PricedCart {
  const priced: QuoteLine[] = []
  for (const line of lines) {
    const unit = unitLookup(line.productId, line.unitId)
    if (!unit) continue
    const amount = unit.price * line.quantity
    const lineDiscount = discountAmount(amount, line.discount)
    priced.push({
      productId: line.productId,
      unitId: line.unitId,
      productName: unit.productName,
      unitName: unit.unitName,
      factor: unit.factor,
      quantity: line.quantity,
      baseQty: line.quantity * unit.factor,
      unitPrice: unit.price,
      amount,
      discountAmount: lineDiscount,
      allocatedDiscount: 0,
      netAmount: amount - lineDiscount,
    })
  }
  const subtotal = priced.reduce((s, l) => s + l.amount, 0)
  const lineDiscountTotal = priced.reduce((s, l) => s + l.discountAmount, 0)
  const afterLine = subtotal - lineDiscountTotal
  const orderDiscountAmount = discountAmount(afterLine, orderDiscount)
  allocate(priced, orderDiscountAmount, afterLine)
  const discountTotal = lineDiscountTotal + orderDiscountAmount
  return {
    lines: priced,
    subtotal,
    lineDiscountTotal,
    orderDiscountAmount,
    discountTotal,
    discountPct: subtotal > 0 ? round1dp((discountTotal / subtotal) * 100) : 0,
    total: Math.max(0, afterLine - orderDiscountAmount),
  }
}

/** BR-14: phân bổ giảm hóa đơn theo tỷ lệ `amount − discountAmount`, dòng cuối nhận phần còn lại */
function allocate(lines: QuoteLine[], orderDiscount: number, afterLine: number) {
  let allocated = 0
  lines.forEach((line, i) => {
    const base = line.amount - line.discountAmount
    line.allocatedDiscount =
      i === lines.length - 1
        ? orderDiscount - allocated
        : afterLine === 0
          ? 0
          : round1((orderDiscount * base) / afterLine)
    allocated += line.allocatedDiscount
    line.netAmount = base - line.allocatedDiscount
  })
}

/**
 * Lý do cần chủ cửa hàng xác nhận (§3.4, BR-08, BR-09). `expectedCost` = Σ baseQty × giá vốn hiện tại.
 * Hạn mức so giá trị chưa làm tròn, "> 5%" mới cần (đúng 5% tự giảm được).
 */
export function approvalReasons(
  quote: Pick<PricedCart, 'subtotal' | 'discountTotal' | 'total'>,
  expectedCost?: number | null
): ApprovalReason[] {
  const reasons: ApprovalReason[] = []
  if (quote.subtotal > 0 && quote.discountTotal * 100 > quote.subtotal * posRules.cashierDiscountLimitPct) {
    const pct = round1dp((quote.discountTotal / quote.subtotal) * 100)
    reasons.push({
      code: 'VuotHanMuc',
      text: `Giảm ${formatNumber(pct, 1)}%, vượt hạn mức ${posRules.cashierDiscountLimitPct}%`,
    })
  }
  if (expectedCost !== null && expectedCost !== undefined && quote.total < expectedCost) {
    reasons.push({ code: 'DuoiGiaVon', text: `Thấp hơn giá vốn ${formatVnd(expectedCost - quote.total)}` })
  }
  return reasons
}

/** Mức tiền mặt gợi ý (§3.5, BR-12): đúng tiền, làm tròn lên 10k / 50k / 100k / 500k, bỏ trùng. */
export function cashSuggestions(total: number): number[] {
  const result = [total]
  for (const step of [10000, 50000, 100000, 500000]) {
    const v = Math.ceil(total / step) * step
    if (!result.includes(v)) result.push(v)
  }
  return result.sort((a, b) => a - b)
}

/** Điểm tích lũy (BR-31): ⌊tiền ÷ 20.000⌋ */
export const pointsFor = (amount: number): number => Math.max(0, Math.floor(amount / posRules.pointValue))

/** Dòng hóa đơn gốc để tính tiền hoàn */
export type RefundableLine = {
  quantity: number
  netAmount: number
  returnedQty: number
  refundedAmount: number
}

/**
 * Tiền hoàn một dòng khi trả `q` (§3.6, BR-18): trả hết phần còn lại → phần thuần còn lại (có thể lẻ);
 * còn lại → floor500(netAmount × q ÷ quantity).
 */
export function refundForLine(line: RefundableLine, q: number): number {
  if (q <= 0) return 0
  if (line.returnedQty + q >= line.quantity) return line.netAmount - line.refundedAmount
  return floor500((line.netAmount * q) / line.quantity)
}

/** Đơn giá thực thu để hiển thị (netAmount ÷ quantity, làm tròn 1 ₫) */
export const unitNetPrice = (line: Pick<RefundableLine, 'netAmount' | 'quantity'>): number =>
  line.quantity > 0 ? round1(line.netAmount / line.quantity) : 0

/** Còn thiếu khi khách đưa tiền mặt (BR-12); 0 khi đủ */
export const cashShortage = (due: number, received: number | null | undefined): number =>
  Math.max(0, due - (received ?? 0))
