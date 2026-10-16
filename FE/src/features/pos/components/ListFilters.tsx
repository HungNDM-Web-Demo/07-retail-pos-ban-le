'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { addDaysKey, vnTodayKey } from '../lib/vn-time'

const ALL = '__all__'

/** Ô chọn lọc một giá trị, có mục "Tất cả" (danh sách hóa đơn, đổi trả) */
export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value?: T
  options: Record<T, string>
  onChange: (value: T | undefined) => void
  className?: string
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : (v as T))}>
      <SelectTrigger className={className ?? 'h-10 w-auto min-w-40 whitespace-nowrap'} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: tất cả</SelectItem>
        {(Object.keys(options) as T[]).map((k) => (
          <SelectItem key={k} value={k}>
            {options[k]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export type RangePreset = 'today' | '7d' | '30d' | 'all'
export const rangePresetLabels: Record<RangePreset, string> = {
  today: 'Hôm nay',
  '7d': '7 ngày',
  '30d': '30 ngày',
  all: 'Mọi ngày',
}

/** Khoảng ngày (giờ Việt Nam) của lựa chọn nhanh */
export function presetRange(preset: RangePreset): { from?: string; to?: string } {
  const today = vnTodayKey()
  if (preset === 'today') return { from: today, to: today }
  if (preset === '7d') return { from: addDaysKey(today, -6), to: today }
  if (preset === '30d') return { from: addDaysKey(today, -29), to: today }
  return { from: undefined, to: undefined }
}

export function RangeSelect({ value, onChange }: { value: RangePreset; onChange: (v: RangePreset) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as RangePreset)}>
      <SelectTrigger className="h-10 w-36" aria-label="Khoảng ngày">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(rangePresetLabels) as RangePreset[]).map((k) => (
          <SelectItem key={k} value={k}>
            {rangePresetLabels[k]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
