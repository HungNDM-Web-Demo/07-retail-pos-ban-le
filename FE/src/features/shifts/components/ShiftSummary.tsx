import { paymentMethodLabels } from '@/config/retail-pos-labels'
import { formatSignedVnd } from '@/features/pos/lib/money'
import { formatDateTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ShiftDto } from '@/types/retail-pos'

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'muted' | 'danger' | 'success' }) {
  return (
    <div className={cn('flex justify-between gap-3 py-1', strong && 'text-base font-semibold')}>
      <dt className={cn(!strong && 'text-muted-foreground')}>{label}</dt>
      <dd
        className={cn(
          'tabular-nums',
          tone === 'danger' && 'text-destructive font-semibold',
          tone === 'success' && 'text-success font-semibold'
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/** Tổng hợp ca (SCR-06, §3.7): doanh thu theo phương thức, tiền hoàn, tiền mặt lý thuyết (BR-21) */
export function ShiftSummary({ shift }: { shift: ShiftDto }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <dl className="rounded-xl border p-4 text-sm">
        <Line label="Mở lúc" value={formatDateTime(shift.openedAt)} />
        {shift.closedAt && <Line label="Chốt lúc" value={formatDateTime(shift.closedAt)} />}
        <Line label="Số hóa đơn" value={String(shift.orderCount)} />
        <Line label="Số phiếu đổi trả" value={String(shift.returnCount)} />
        <Line label="Tổng bán" value={formatVnd(shift.salesTotal)} />
        <Line label="Tiền hoàn" value={formatVnd(shift.refundTotal)} />
        <Line label="Doanh thu thuần" value={formatVnd(shift.netRevenue)} strong />
      </dl>
      <dl className="rounded-xl border p-4 text-sm">
        {(['TienMat', 'ChuyenKhoan', 'The', 'BuTruDoiHang'] as const).map((m) => (
          <Line key={m} label={`Thu ${paymentMethodLabels[m].toLowerCase()}`} value={formatVnd(shift.salesByMethod[m] ?? 0)} />
        ))}
        <Line label="Hoàn tiền mặt" value={formatVnd(shift.refundByMethod.TienMat)} />
        <Line label="Hoàn chuyển khoản" value={formatVnd(shift.refundByMethod.ChuyenKhoan)} />
        <Line label="Tiền đầu ca" value={formatVnd(shift.openingCash)} />
        <Line label="Tiền mặt lý thuyết" value={formatVnd(shift.expectedCash)} strong />
        {shift.countedCash !== undefined && shift.countedCash !== null && (
          <>
            <Line label="Tiền thực đếm" value={formatVnd(shift.countedCash)} />
            <Line
              label="Chênh lệch"
              value={formatSignedVnd(shift.difference ?? 0)}
              tone={Math.abs(shift.difference ?? 0) > 20000 ? 'danger' : 'success'}
            />
          </>
        )}
      </dl>
    </div>
  )
}
