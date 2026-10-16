'use client'

import { useState } from 'react'
import { Loader2, Percent } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { discountReasonLabels } from '@/config/retail-pos-labels'
import { formatVnd } from '@/lib/format'
import type { DiscountInput, DiscountReason, DiscountType } from '@/types/retail-pos'
import { discountAmount, discountExceeds, validateDiscountValue } from '../lib/pricing'
import { MoneyInput } from './MoneyInput'

export type DiscountScope = 'order' | 'line'

type DiscountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dòng đang chọn (tên, thành tiền) — vắng thì chỉ giảm hóa đơn */
  line?: { name: string; amount: number; discount?: DiscountInput }
  /** Tiền hàng sau giảm dòng (cơ sở giảm hóa đơn) */
  orderBase: number
  orderDiscount?: DiscountInput
  pending?: boolean
  onApply: (scope: DiscountScope, discount: DiscountInput) => void
  onRemove: (scope: DiscountScope) => void
}

const REASONS = Object.keys(discountReasonLabels) as DiscountReason[]

/**
 * Giảm giá F8 (UC-05): hóa đơn hoặc dòng đang chọn, phần trăm hoặc số tiền (bội số 500), lý do ("Khác" bắt
 * ghi chú). Bấm Áp dụng → trang gọi quote, cần xác nhận thì mở hộp chủ cửa hàng (BR-08, BR-09).
 */
export function DiscountDialog(props: DiscountDialogProps) {
  const { open, onOpenChange } = props
  return (
    <Dialog open={open} onOpenChange={(v) => !props.pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">{open && <DiscountForm {...props} />}</DialogContent>
    </Dialog>
  )
}

function DiscountForm({ line, orderBase, orderDiscount, pending, onApply, onRemove, onOpenChange }: DiscountDialogProps) {
  const [scope, setScope] = useState<DiscountScope>('order')
  const current = scope === 'line' ? line?.discount : orderDiscount
  const [type, setType] = useState<DiscountType>(current?.type ?? 'PhanTram')
  const [value, setValue] = useState<number | null>(current?.value ?? null)
  const [reason, setReason] = useState<DiscountReason>(current?.reason ?? 'KhachQuen')
  const [note, setNote] = useState(current?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const base = scope === 'line' ? (line?.amount ?? 0) : orderBase
  const preview = value ? discountAmount(base, { type, value }) : 0

  const switchScope = (next: DiscountScope) => {
    setScope(next)
    const d = next === 'line' ? line?.discount : orderDiscount
    setType(d?.type ?? 'PhanTram')
    setValue(d?.value ?? null)
    setReason(d?.reason ?? 'KhachQuen')
    setNote(d?.note ?? '')
    setError(null)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (value === null) return setError('Nhập mức giảm')
    const invalid = validateDiscountValue({ type, value })
    if (invalid) return setError(invalid)
    if (discountExceeds(base, { type, value })) return setError('Số tiền giảm lớn hơn tổng tiền hàng')
    if (reason === 'Khac' && !note.trim()) return setError('Nhập ghi chú lý do giảm giá')
    onApply(scope, { type, value, reason, ...(note.trim() ? { note: note.trim() } : {}) })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Percent className="size-5" aria-hidden="true" /> Giảm giá
        </DialogTitle>
        <DialogDescription>Thu ngân tự giảm tối đa 5% tổng tiền hàng; vượt mức cần chủ cửa hàng xác nhận.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <ToggleGroup
          type="single"
          variant="outline"
          value={scope}
          onValueChange={(v) => v && switchScope(v as DiscountScope)}
          className="w-full"
        >
          <ToggleGroupItem value="order" className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-11 flex-1">
            Hóa đơn
          </ToggleGroupItem>
          <ToggleGroupItem value="line" className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-11 flex-1" disabled={!line}>
            Dòng đang chọn
          </ToggleGroupItem>
        </ToggleGroup>
        {scope === 'line' && line && (
          <p className="text-muted-foreground -mt-2 truncate text-sm">
            {line.name} · {formatVnd(line.amount)}
          </p>
        )}
        <div className="grid grid-cols-[auto_1fr] items-end gap-3">
          <ToggleGroup
            type="single"
            variant="outline"
            value={type}
            onValueChange={(v) => {
              if (!v) return
              setType(v as DiscountType)
              setValue(null)
              setError(null)
            }}
          >
            <ToggleGroupItem value="PhanTram" className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-11 px-4" aria-label="Phần trăm">
              %
            </ToggleGroupItem>
            <ToggleGroupItem value="SoTien" className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-11 px-4" aria-label="Số tiền">
              ₫
            </ToggleGroupItem>
          </ToggleGroup>
          {type === 'PhanTram' ? (
            <Input
              aria-label="Phần trăm giảm"
              inputMode="decimal"
              autoFocus
              className="h-11 text-right text-lg tabular-nums"
              value={value ?? ''}
              onChange={(e) => {
                const v = e.target.value.replace(',', '.')
                setValue(v === '' ? null : Number(v))
                setError(null)
              }}
              placeholder="vd 5"
            />
          ) : (
            <MoneyInput
              aria-label="Số tiền giảm"
              autoFocus
              className="h-11 text-lg"
              value={value}
              onChange={(v) => {
                setValue(v)
                setError(null)
              }}
            />
          )}
        </div>
        <FormField label="Lý do" htmlFor="discount-reason" required>
          <ToggleGroup
            id="discount-reason"
            type="single"
            variant="outline"
            value={reason}
            onValueChange={(v) => v && setReason(v as DiscountReason)}
            className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {REASONS.map((r) => (
              <ToggleGroupItem key={r} value={r} className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-10 rounded-md border text-xs sm:text-sm">
                {discountReasonLabels[r]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </FormField>
        {reason === 'Khac' && (
          <FormField label="Ghi chú" htmlFor="discount-note" required>
            <Textarea id="discount-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </FormField>
        )}
        <div className="bg-muted/60 flex items-center justify-between rounded-lg px-3 py-2 text-sm">
          <span className="text-muted-foreground">Số tiền giảm</span>
          <span className="text-base font-semibold tabular-nums">{formatVnd(preview)}</span>
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter className="gap-2">
          {current && (
            <Button type="button" variant="destructive" className="h-11 sm:mr-auto" onClick={() => onRemove(scope)}>
              Gỡ giảm giá
            </Button>
          )}
          <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button type="submit" className="h-11 min-w-28" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Áp dụng
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
