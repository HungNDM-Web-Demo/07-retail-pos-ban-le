'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, Printer, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { permissions } from '@/config/permissions'
import {
  approvalActionLabels,
  orderReturnStatusLabels,
  orderReturnStatusVariants,
  paymentMethodLabels,
  refundMethodLabels,
  shiftStatusLabels,
  shiftStatusVariants,
} from '@/config/retail-pos-labels'
import { routePath, routeTo } from '@/config/route-path'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatDateTime, formatTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PaymentMethod } from '@/types/retail-pos'
import { useReviewShift, useShiftDetail } from '../hooks/use-shift-review'
import { DifferenceText } from './DifferenceText'

const SALES: PaymentMethod[] = ['TienMat', 'ChuyenKhoan', 'The', 'BuTruDoiHang']

/**
 * Chi tiết ca (SCR-07, UC-10, FR-29): tổng hợp như lúc chốt, hóa đơn, phiếu đổi trả, các khoản có người xác nhận;
 * ghi chú + "Đã kiểm tra" chỉ với `shifts.review` và ca Cần kiểm tra (ca đang mở không có nút, UC-10 E1).
 */
export function ShiftDetailSheet({ shiftId, onOpenChange }: { shiftId: string | null; onOpenChange: (open: boolean) => void }) {
  const { can } = usePermissions()
  const q = useShiftDetail(shiftId)
  const review = useReviewShift()
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [lastId, setLastId] = useState<string | null>(null)
  if (shiftId !== lastId) {
    setLastId(shiftId)
    setNote('')
    setNoteError(null)
  }
  const s = q.data

  const submit = () => {
    if (!s) return
    if (!note.trim()) {
      setNoteError('Nhập ghi chú xử lý')
      return
    }
    review.mutate(
      { id: s.id, note: note.trim() },
      {
        onSuccess: () => toast.success(`Ca ${s.code} đã chuyển Đã kiểm tra`),
        onError: (e) => {
          const field = getFieldErrors(e).note
          if (field) setNoteError(field)
          else toast.error(getErrorMessage(e))
        },
      }
    )
  }

  return (
    <Sheet open={!!shiftId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            Ca {s?.code ?? ''}
            {s && <StatusBadge tone={shiftStatusVariants[s.status]}>{shiftStatusLabels[s.status]}</StatusBadge>}
          </SheetTitle>
          <SheetDescription>
            {s
              ? `${s.cashierName} · ${formatDateTime(s.openedAt)} → ${s.closedAt ? formatTime(s.closedAt) : 'đang mở'}`
              : 'Đang tải…'}
          </SheetDescription>
          {s && s.status !== 'DangMo' && (
            <Button variant="outline" size="sm" className="mt-1 w-fit" asChild>
              <a href={`${routeTo.shiftReceipt(s.id)}?reprint=1`} target="_blank" rel="noopener noreferrer">
                <Printer aria-hidden="true" />
                In báo cáo ca
              </a>
            </Button>
          )}
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          {q.error ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          ) : !s ? (
            <div className="space-y-3">
              <Skeleton className="h-40" />
              <Skeleton className="h-60" />
            </div>
          ) : (
            <>
              {/* Kiểm tra ca */}
              {s.status === 'CanKiemTra' && can(permissions.shifts.review) && (
                <section className="border-destructive/40 bg-destructive/5 space-y-2 rounded-xl border p-4" aria-label="Xử lý ca lệch">
                  <p className="font-medium">
                    Ca lệch <DifferenceText value={s.difference} strong />, cần kiểm tra
                  </p>
                  {s.note && <p className="text-sm">Thu ngân ghi: “{s.note}”</p>}
                  <label htmlFor="review-note" className="text-sm font-medium">
                    Ghi chú xử lý <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    id="review-note"
                    rows={3}
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value)
                      setNoteError(null)
                    }}
                    placeholder="vd: Đã đối chiếu camera, thu ngân thối nhầm cho khách; trừ lương 45.000 ₫"
                    aria-invalid={!!noteError || undefined}
                    aria-describedby={noteError ? 'review-note-error' : undefined}
                  />
                  {noteError && (
                    <p id="review-note-error" className="text-destructive text-sm" role="alert">
                      {noteError}
                    </p>
                  )}
                  <Button onClick={submit} disabled={review.isPending}>
                    {review.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                    Đã kiểm tra
                  </Button>
                </section>
              )}
              {s.status === 'DaKiemTra' && (
                <section className="bg-muted/40 space-y-1 rounded-xl border p-4">
                  <p className="flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="text-success size-4" aria-hidden="true" />
                    Đã kiểm tra bởi {s.reviewedByName} lúc {formatDateTime(s.reviewedAt)}
                  </p>
                  <p className="text-sm">{s.reviewNote}</p>
                  {s.note && <p className="text-muted-foreground text-xs">Thu ngân ghi: “{s.note}”</p>}
                </section>
              )}

              {/* Tổng hợp như lúc chốt (FR-28) */}
              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <h3 className="mb-2 text-sm font-semibold">Thu theo phương thức · {s.orderCount} hóa đơn</h3>
                  <dl className="space-y-1 text-sm">
                    {SALES.map((m) => (
                      <Row key={m} label={paymentMethodLabels[m]} value={formatVnd(s.salesByMethod[m] ?? 0)} />
                    ))}
                    <Row label="Tổng thanh toán" value={formatVnd(s.salesTotal)} strong />
                  </dl>
                </div>
                <div className="rounded-xl border p-4">
                  <h3 className="mb-2 text-sm font-semibold">Hoàn tiền · {s.returnCount} phiếu đổi trả</h3>
                  <dl className="space-y-1 text-sm">
                    <Row label="Tiền mặt" value={formatVnd(s.refundByMethod.TienMat)} />
                    <Row label="Chuyển khoản" value={formatVnd(s.refundByMethod.ChuyenKhoan)} />
                    <Row label="Bù trừ đổi hàng" value={formatVnd(s.refundByMethod.BuTruDoiHang)} />
                    <Row label="Doanh thu thuần" value={formatVnd(s.netRevenue)} strong />
                  </dl>
                </div>
                <div className="rounded-xl border p-4 sm:col-span-2">
                  <h3 className="mb-2 text-sm font-semibold">Két tiền mặt</h3>
                  <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <Row label="Tiền đầu ca" value={formatVnd(s.openingCash)} />
                    <Row label="Tiền mặt lý thuyết" value={formatVnd(s.expectedCash)} strong />
                    <Row label="Thực đếm" value={formatVnd(s.countedCash)} />
                    <Row label="Chênh lệch" value={<DifferenceText value={s.difference} strong />} />
                  </dl>
                  {s.status !== 'CanKiemTra' && s.note && <p className="text-muted-foreground mt-2 text-xs">Ghi chú thu ngân: {s.note}</p>}
                </div>
              </section>

              <Tabs defaultValue="orders" className="gap-3">
                <TabsList>
                  <TabsTrigger value="orders">Hóa đơn ({s.orders.length})</TabsTrigger>
                  <TabsTrigger value="returns">Đổi trả ({s.returns.length})</TabsTrigger>
                  <TabsTrigger value="approvals">Có xác nhận ({s.approvals.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="orders">
                  <SimpleTable
                    empty="Ca chưa có hóa đơn"
                    head={['Mã', 'Giờ', 'Phương thức', 'Tổng', 'Trạng thái']}
                    rows={s.orders.map((o) => [
                      <DocLink key="c" href={`${routePath.orders}?search=${o.code}`} code={o.code} />,
                      formatTime(o.paidAt),
                      o.paymentMethods.map((m) => paymentMethodLabels[m]).join(' + '),
                      <span key="t" className="font-medium tabular-nums">
                        {formatVnd(o.total)}
                        {o.approvedByName && <span className="text-muted-foreground block text-xs font-normal">Duyệt: {o.approvedByName}</span>}
                      </span>,
                      <StatusBadge key="s" tone={orderReturnStatusVariants[o.returnStatus]}>
                        {orderReturnStatusLabels[o.returnStatus]}
                      </StatusBadge>,
                    ])}
                  />
                </TabsContent>
                <TabsContent value="returns">
                  <SimpleTable
                    empty="Ca không có phiếu đổi trả"
                    head={['Mã', 'Giờ', 'HĐ gốc', 'Tiền hoàn', 'Hình thức']}
                    rows={s.returns.map((r) => [
                      <DocLink key="c" href={`${routePath.returns}?search=${r.code}`} code={r.code} />,
                      formatTime(r.createdAt),
                      <span key="o" className="font-mono text-xs">
                        {r.orderCode}
                      </span>,
                      <span key="t" className="font-medium tabular-nums">
                        {formatVnd(r.refundTotal)}
                      </span>,
                      r.exchangeOrderCode ? `Đổi hàng ${r.exchangeOrderCode}` : refundMethodLabels[r.refundMethod],
                    ])}
                  />
                </TabsContent>
                <TabsContent value="approvals">
                  <SimpleTable
                    empty="Không có khoản cần chủ cửa hàng xác nhận"
                    head={['Loại', 'Chứng từ', 'Giờ', 'Số tiền', 'Người xác nhận']}
                    rows={s.approvals.map((a) => [
                      approvalActionLabels[a.action],
                      <span key="c" className="font-mono text-xs">
                        {a.documentCode}
                      </span>,
                      formatTime(a.at),
                      <span key="t" className="tabular-nums">
                        {formatVnd(a.amount)}
                      </span>,
                      a.approvedByName,
                    ])}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3', strong && 'border-t pt-1 font-semibold')}>
      <dt className={cn(!strong && 'text-muted-foreground')}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

function DocLink({ href, code }: { href: string; code: string }) {
  return (
    <Link href={href} className="text-primary font-mono text-xs underline-offset-4 hover:underline">
      {code}
    </Link>
  )
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">{empty}</p>
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
