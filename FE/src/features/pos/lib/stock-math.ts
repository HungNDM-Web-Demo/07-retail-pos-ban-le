import { posRules } from '@/config/pos-rules'
import type { LotStatus, StockStatus } from '@/types/retail-pos'
import { round1, round1dp } from './pricing'

/**
 * Tồn, giá vốn, lô (07 §3.8; BE `Domain/Entities/Pos/StockMath.cs`). Tồn và giá vốn theo đơn vị cơ bản.
 */

/** Dấu trừ U+2212 dùng khi hiển thị số âm */
export const MINUS = '−'

/** Từ đầu tiên của tên đơn vị, chữ thường ("Thùng 24" → "thùng") */
export const unitWord = (name: string): string => (name.trim().split(/\s+/)[0] ?? '').toLocaleLowerCase('vi')

/**
 * Đọc tồn quy đổi (BR-02, quyết định 19): chia lần lượt cho đơn vị hệ số lớn → nhỏ, bỏ phần bằng 0.
 * `units` gồm cả đơn vị cơ bản (factor 1). Tồn 0 → "0 lon"; tồn âm → "−3 lon".
 */
export function stockText(stock: number, units: { name: string; factor: number }[]): string {
  const base = units.find((u) => u.factor === 1) ?? units[0]
  const baseWord = base ? unitWord(base.name) : ''
  if (stock === 0) return `0 ${baseWord}`.trim()
  if (stock < 0) return `${MINUS}${Math.abs(stock)} ${baseWord}`.trim()
  const sorted = [...units].sort((a, b) => b.factor - a.factor)
  let rest = stock
  const parts: string[] = []
  for (const unit of sorted) {
    if (unit.factor <= 0) continue
    const n = Math.floor(rest / unit.factor)
    if (n > 0) {
      parts.push(`${n} ${unitWord(unit.name)}`)
      rest -= n * unit.factor
    }
  }
  return parts.join(' ')
}

/** Trạng thái tồn (BR-26) */
export function stockStatus(stock: number, minStock: number): StockStatus {
  if (stock < 0) return 'AmKho'
  if (stock === 0) return 'HetHang'
  if (stock <= minStock) return 'SapHet'
  return 'ConHang'
}

/** Biên lãi % 1 chữ số (BR-25); null khi giá 0 */
export function marginPct(price: number, cost: number): number | null {
  if (!price) return null
  return round1dp(((price - cost) / price) * 100)
}

/** Biên lãi thấp (< 5%) */
export const isLowMargin = (pct: number | null | undefined): boolean =>
  pct !== null && pct !== undefined && pct < posRules.lowMarginPct

/**
 * Giá vốn bình quân sau khi nhập `qIn` (đơn vị cơ bản) với giá `unitCostIn` mỗi đơn vị cơ bản (BR-23, BR-19).
 * Tồn hiện tại ≤ 0 → lấy luôn giá nhập.
 */
export function nextAvgCost(stock: number, cost: number, qIn: number, unitCostIn: number): number {
  if (stock <= 0) return round1(unitCostIn)
  return round1((stock * cost + qIn * unitCostIn) / (stock + qIn))
}

/**
 * Ước tính số còn lại từng lô (BR-27). `lots` phải đã sắp mới → cũ (ngày nhập, giờ xác nhận, lineNo).
 * `left = max(tồn, 0)`; mỗi lô nhận `min(left, receivedQty)`.
 */
export function estimateLots<T extends { receivedQty: number }>(
  stock: number,
  lots: T[]
): (T & { remainingQty: number })[] {
  let left = Math.max(stock, 0)
  return lots.map((lot) => {
    const remainingQty = Math.min(left, lot.receivedQty)
    left -= remainingQty
    return { ...lot, remainingQty }
  })
}

/** Trạng thái lô (BR-27): còn hàng và quá hạn → Đã hết hạn; còn hàng và ≤ 30 ngày → Sắp hết hạn */
export function lotStatus(remainingQty: number, daysLeft: number): LotStatus {
  if (remainingQty > 0 && daysLeft < 0) return 'DaHetHan'
  if (remainingQty > 0 && daysLeft <= posRules.expiryWarningDays) return 'SapHetHan'
  return 'ConHan'
}

/** "Vượt tồn {n} {đơn vị cơ bản}" (BR-10, TC-19) */
export const overStockText = (shortage: number, baseUnit: string): string =>
  `Vượt tồn ${shortage} ${unitWord(baseUnit)}`
