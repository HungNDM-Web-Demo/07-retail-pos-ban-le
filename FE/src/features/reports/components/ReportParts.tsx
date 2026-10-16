'use client'

import { useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api-error'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { exportExcel, type ExcelSheet } from '../lib/export-excel'
import type { DateRange } from '../lib/date-range'

/** Props chung của mọi tab báo cáo: khoảng ngày đã hợp lệ, chỉ gọi API khi tab đang mở */
export type ReportTabProps = { range: DateRange; enabled: boolean }

/** Trục tiền gọn: 1.250.000 → "1,3tr", 85.000 → "85k" */
export const compactVnd = (v: number) =>
  Math.abs(v) >= 1_000_000
    ? `${formatNumber(v / 1_000_000, 1)}tr`
    : Math.abs(v) >= 1000
      ? `${formatNumber(v / 1000, 0)}k`
      : formatNumber(v, 0)

/** % thay đổi so với kỳ trước (1 chữ số); null khi kỳ trước bằng 0 */
export const pctChange = (current: number, previous: number): number | null =>
  previous === 0 ? null : Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10

/** Nút "Xuất Excel": dựng trang tính khi bấm (có thể tải thêm dữ liệu) rồi tải file về máy */
export function ExportButton({
  fileName,
  build,
  disabled,
}: {
  fileName: string
  build: () => ExcelSheet[] | Promise<ExcelSheet[]>
  disabled?: boolean
}) {
  const [pending, setPending] = useState(false)
  return (
    <Button
      variant="outline"
      size="lg"
      disabled={disabled || pending}
      onClick={async () => {
        setPending(true)
        try {
          await exportExcel(fileName, await build())
          toast.success('Đã xuất file Excel')
        } catch (error) {
          toast.error(getErrorMessage(error, 'Không xuất được file Excel'))
        } finally {
          setPending(false)
        }
      }}
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <FileSpreadsheet aria-hidden="true" />
      )}
      Xuất Excel
    </Button>
  )
}

/** Thẻ số liệu tổng của tab báo cáo */
export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'destructive'
}) {
  return (
    <div className="bg-card rounded-xl border p-4 shadow-xs">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold tabular-nums',
          tone === 'destructive' && 'text-destructive'
        )}
      >
        {value}
      </p>
      {sub && <div className="text-muted-foreground mt-1 text-xs">{sub}</div>}
    </div>
  )
}

/** "% so với kỳ trước" có mũi tên và màu; không chỉ dựa vào màu */
export function ChangeText({ value, label = 'so với kỳ trước' }: { value?: number | null; label?: string }) {
  if (value === undefined || value === null) return <span>Kỳ trước bằng 0, không so sánh</span>
  const up = value >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold',
        up ? 'text-success' : 'text-destructive'
      )}
    >
      <span aria-hidden="true">{up ? '↑' : '↓'}</span>
      <span className="sr-only">{up ? 'Tăng' : 'Giảm'}</span>
      {formatNumber(Math.abs(value), 1)}% {label}
    </span>
  )
}

/** Khung chờ tải chung: hàng thẻ và một khối biểu đồ */
export function TabLoading({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải báo cáo">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cards }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}

/** Thanh lọc riêng của tab và nút xuất, nằm một hàng phía trên biểu đồ */
export function TabToolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}
