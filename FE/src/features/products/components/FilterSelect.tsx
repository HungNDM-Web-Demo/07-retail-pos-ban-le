'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const ALL = '__all'

/** Ô lọc dạng chọn, có mục "tất cả" ở đầu (dùng chung các màn quản lý) */
export function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  allLabel,
  label,
  className,
}: {
  value: T | undefined
  onChange: (value: T | undefined) => void
  options: { value: T; label: React.ReactNode }[]
  allLabel: string
  /** Nhãn cho trình đọc màn hình */
  label: string
  className?: string
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : (v as T))}>
      <SelectTrigger className={cn('w-full sm:w-44', className)} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
