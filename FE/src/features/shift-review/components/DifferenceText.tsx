import { posRules } from '@/config/pos-rules'
import { formatSignedVnd } from '@/features/products/lib/product-format'
import { cn } from '@/lib/utils'

/** Chênh lệch ca: xanh khi ≤ 20.000 ₫, đỏ khi vượt (BR-22); số âm dùng "−" */
export function DifferenceText({ value, strong, className }: { value: number | null | undefined; strong?: boolean; className?: string }) {
  if (value === null || value === undefined) return <span className={cn('text-muted-foreground', className)}>—</span>
  const over = Math.abs(value) > posRules.shiftDifferenceThreshold
  return (
    <span className={cn('tabular-nums', over ? 'text-destructive' : 'text-success', strong && 'font-semibold', className)}>
      {formatSignedVnd(value, true)}
    </span>
  )
}
