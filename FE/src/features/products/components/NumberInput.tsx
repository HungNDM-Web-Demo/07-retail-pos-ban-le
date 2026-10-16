'use client'

import { forwardRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type NumberInputProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: number | null | undefined
  onValueChange: (value: number | undefined) => void
  /** Chữ nhỏ bên phải ô, vd "₫" */
  suffix?: string
}

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/**
 * Ô số nguyên có dấu chấm ngăn cách hàng nghìn (tiền, số lượng). Chỉ nhận chữ số; xóa trắng → undefined.
 * Bàn phím số trên điện thoại (inputMode numeric).
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, onValueChange, suffix, className, onFocus, onBlur, ...props },
  ref
) {
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? (value === null || value === undefined || Number.isNaN(value) ? '' : group(String(Math.trunc(value))))

  return (
    <div className="relative">
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={shown}
        onFocus={(e) => {
          e.currentTarget.select()
          onFocus?.(e)
        }}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
          setText(group(digits))
          onValueChange(digits === '' ? undefined : Number(digits))
        }}
        onBlur={(e) => {
          setText(null)
          onBlur?.(e)
        }}
        className={cn('text-right tabular-nums', suffix && 'pr-8', className)}
        {...props}
      />
      {suffix && (
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
          {suffix}
        </span>
      )}
    </div>
  )
})
