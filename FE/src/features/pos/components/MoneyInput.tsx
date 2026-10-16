'use client'

import { forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type MoneyInputProps = Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: number | null
  onChange: (value: number | null) => void
}

const format = (value: number | null) =>
  value === null || Number.isNaN(value) ? '' : new Intl.NumberFormat('vi-VN').format(value)

/** Ô nhập tiền VNĐ: tự chèn dấu chấm ngàn, giá trị là số nguyên. Chép từ demo 03. */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onChange, className, ...props },
  ref
) {
  return (
    <div className="relative">
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={format(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 12)
          onChange(digits ? Number(digits) : null)
        }}
        className={cn('pr-8 text-right tabular-nums', className)}
        {...props}
      />
      <span
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm"
        aria-hidden="true"
      >
        ₫
      </span>
    </div>
  )
})
