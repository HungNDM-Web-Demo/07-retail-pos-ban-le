import { posRules } from '@/config/pos-rules'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Dấu trừ U+2212 cho số âm (07 §4.6) */
export const MINUS = '−'

/** 12.5 → "12,5%"; −3 → "−3,0%" (1 chữ số, dấu phẩy) */
export function formatPct(value: number | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback
  const text = formatNumber(Math.abs(value), 1)
  return `${value < 0 ? MINUS : ''}${text.includes(',') ? text : `${text},0`}%`
}

/** Tiền có dấu: −156.000 ₫ (U+2212), +150 khi `plus` */
export function formatSignedVnd(value: number | null | undefined, plus = false): string {
  if (value === null || value === undefined) return '—'
  if (value < 0) return `${MINUS}${formatVnd(Math.abs(value))}`
  return `${plus && value > 0 ? '+' : ''}${formatVnd(value)}`
}

/** Số lượng có dấu: −24, +150 */
export function formatSignedQty(value: number, plus = true): string {
  if (value < 0) return `${MINUS}${formatNumber(Math.abs(value), 0)}`
  return `${plus && value > 0 ? '+' : ''}${formatNumber(value, 0)}`
}

/** Biên lãi; dưới 5% nền cam kèm chữ "thấp" để không chỉ dựa vào màu (BR-25) */
export function MarginText({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>
  const low = value < posRules.lowMarginPct
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 tabular-nums',
        low ? 'bg-warning/15 text-warning font-semibold' : 'text-foreground',
        className
      )}
      title={low ? 'Biên lãi dưới 5%' : undefined}
    >
      {formatPct(value)}
      {low && <span className="text-[0.6875rem] font-medium">thấp</span>}
    </span>
  )
}
