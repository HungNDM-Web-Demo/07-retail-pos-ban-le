'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { posRules } from '@/config/pos-rules'
import { MoneyInput } from '@/features/pos/components/MoneyInput'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import type { ShiftDto } from '@/types/retail-pos'
import { useOpenShift } from '../hooks/use-shifts'

type OpenShiftFormProps = {
  defaultOpeningCash: number
  onOpened?: (shift: ShiftDto) => void
  onCancel?: () => void
  autoFocus?: boolean
}

/**
 * Mở ca (UC-02, TC-05): tiền đầu ca mặc định theo cài đặt, sửa được; lệch mức mặc định quá 100.000 ₫ thì
 * hỏi lại "Tiền đầu ca khác mức thường ngày, xác nhận?" (UC-02 2a).
 */
export function OpenShiftForm({ defaultOpeningCash, onOpened, onCancel, autoFocus = true }: OpenShiftFormProps) {
  const [cash, setCash] = useState<number | null>(defaultOpeningCash)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = useOpenShift()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (cash === null) return setError('Nhập tiền đầu ca')
    if (!confirming && Math.abs(cash - defaultOpeningCash) > posRules.openingCashWarnDelta) {
      setConfirming(true)
      return
    }
    open.mutate(
      { openingCash: cash },
      {
        onSuccess: (shift) => {
          toast.success(`Đã mở ca ${shift.code}`)
          onOpened?.(shift)
        },
        onError: (err) => setError(getFieldErrors(err).openingCash ?? getErrorMessage(err)),
      }
    )
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <FormField
        label="Tiền đầu ca"
        htmlFor="opening-cash"
        required
        error={error ?? undefined}
        hint={`Mức thường ngày ${formatVnd(defaultOpeningCash)}`}
      >
        <MoneyInput
          id="opening-cash"
          value={cash}
          onChange={(v) => {
            setCash(v)
            setConfirming(false)
          }}
          className="h-12 text-lg font-semibold"
          autoFocus={autoFocus}
        />
      </FormField>
      {confirming && (
        <div role="alert" className="border-warning/40 bg-warning/10 text-warning flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Tiền đầu ca khác mức thường ngày, xác nhận? Bấm Mở ca lần nữa để xác nhận.</span>
        </div>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" className="h-11" onClick={onCancel} disabled={open.isPending}>
            Để sau
          </Button>
        )}
        <Button type="submit" className="h-11 min-w-32" disabled={open.isPending}>
          {open.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
          {confirming ? 'Xác nhận mở ca' : 'Mở ca'}
        </Button>
      </div>
    </form>
  )
}
