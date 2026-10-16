'use client'
import { formatSignedVnd } from '@/features/pos/lib/money'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, Lock } from 'lucide-react'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { posRules } from '@/config/pos-rules'
import { cashDenominations } from '@/config/retail-pos-labels'
import { routePath } from '@/config/route-path'
import type { HeldTab } from '@/features/pos/stores/held-tabs.store'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ShiftDto } from '@/types/retail-pos'
import { useCloseShift } from '../hooks/use-shifts'

type CloseShiftDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift: ShiftDto
  /** Hóa đơn chờ còn hàng trên máy này (BR-11, TC-10) */
  heldWithLines: HeldTab[]
  onClosed: (shift: ShiftDto) => void
}

/**
 * Chốt ca (UC-09): còn hóa đơn chờ có hàng thì chặn (TC-10); đếm tiền theo mệnh giá, tiền thực đếm, chênh lệch
 * xanh khi ≤ 20.000 ₫, đỏ khi vượt và bắt ghi chú (BR-22, TC-07, TC-08).
 */
export function CloseShiftDialog(props: CloseShiftDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-xl">{props.open && <CloseShiftForm {...props} />}</DialogContent>
    </Dialog>
  )
}

function CloseShiftForm({ shift, heldWithLines, onClosed, onOpenChange }: CloseShiftDialogProps) {
  const close = useCloseShift()
  const [counts, setCounts] = useState<Record<number, string>>({})
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const counted = useMemo(
    () => cashDenominations.reduce((s, d) => s + d * (Number(counts[d]) || 0), 0),
    [counts]
  )
  const difference = counted - shift.expectedCash
  const over = Math.abs(difference) > posRules.shiftDifferenceThreshold

  if (heldWithLines.length) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Chưa chốt được ca</DialogTitle>
          <DialogDescription>
            Còn {heldWithLines.length} hóa đơn chờ, thanh toán hoặc xóa trước khi chốt ca
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1.5 text-sm">
          {heldWithLines.map((t) => (
            <li key={t.id} className="bg-warning/10 text-warning flex items-center gap-2 rounded-md px-3 py-2 font-medium">
              <AlertTriangle className="size-4" aria-hidden="true" /> {t.name}: {t.lines.length} dòng hàng
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button asChild>
            <Link href={routePath.pos}>Về màn bán hàng</Link>
          </Button>
        </DialogFooter>
      </>
    )
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (over && !note.trim()) return setError('Chênh lệch quá 20.000 ₫, cần ghi chú')
    close.mutate(
      {
        cashCount: cashDenominations
          .map((d) => ({ denomination: d, count: Number(counts[d]) || 0 }))
          .filter((c) => c.count > 0),
        note: note.trim() || undefined,
      },
      {
        onSuccess: onClosed,
        onError: (err) => setError(getFieldErrors(err).note ?? getErrorMessage(err)),
      }
    )
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Chốt ca {shift.code}</DialogTitle>
        <DialogDescription>Đếm tiền trong két theo từng mệnh giá.</DialogDescription>
      </DialogHeader>
      <div className="grid max-h-[46vh] grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto pr-1">
        {cashDenominations.map((d) => (
          <label key={d} className="flex items-center gap-2 text-sm">
            <span className="w-20 text-right font-medium tabular-nums">{formatNumber(d, 0)}</span>
            <span className="text-muted-foreground">×</span>
            <input
              inputMode="numeric"
              aria-label={`Số tờ ${formatNumber(d, 0)}`}
              value={counts[d] ?? ''}
              onChange={(e) => setCounts((c) => ({ ...c, [d]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              className="border-input bg-background focus-visible:ring-ring/50 h-9 w-20 rounded-md border px-2 text-right tabular-nums focus-visible:ring-3 focus-visible:outline-none"
              placeholder="0"
            />
            <span className="text-muted-foreground ml-auto text-xs tabular-nums">
              {Number(counts[d]) ? formatNumber(d * Number(counts[d]), 0) : ''}
            </span>
          </label>
        ))}
      </div>
      <dl className="grid gap-1 rounded-xl border p-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Tiền mặt lý thuyết</dt>
          <dd className="font-medium tabular-nums">{formatVnd(shift.expectedCash)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Tiền thực đếm</dt>
          <dd className="text-base font-semibold tabular-nums">{formatVnd(counted)}</dd>
        </div>
        <div className={cn('flex justify-between rounded-md px-2 py-1', over ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
          <dt className="font-medium">Chênh lệch</dt>
          <dd className="text-lg font-bold tabular-nums">{formatSignedVnd(difference)}</dd>
        </div>
      </dl>
      <FormField label="Ghi chú" htmlFor="close-note" required={over} hint={over ? 'Chênh lệch quá 20.000 ₫, cần ghi chú' : undefined}>
        <Textarea id="close-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </FormField>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={close.isPending}>
          Hủy
        </Button>
        <Button type="submit" variant="cta" disabled={close.isPending}>
          {close.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Lock aria-hidden="true" />}
          Xác nhận chốt ca
        </Button>
      </DialogFooter>
    </form>
  )
}
