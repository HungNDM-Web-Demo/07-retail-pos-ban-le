'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, Banknote, CreditCard, Loader2, QrCode } from 'lucide-react'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StoreProfile, TenderInput, TenderMethod } from '@/types/retail-pos'
import { cashShortage, cashSuggestions } from '../lib/pricing'
import { vietQrPayload } from '../lib/vietqr'
import { Kbd } from './Kbd'
import { MoneyInput } from './MoneyInput'
import { QrImage } from './QrImage'

type CheckoutDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Số phải thu (hóa đơn đổi hàng: phần chênh lệch) */
  amount: number
  title?: string
  /** Mã hóa đơn dự kiến cho nội dung chuyển khoản */
  nextCode?: string
  store?: StoreProfile
  pending?: boolean
  error?: string | null
  onSubmit: (tender: TenderInput, qrContent?: string) => void
}

/**
 * Thanh toán F9 (SCR-03, UC-06): tiền mặt (mặc định, gợi ý mệnh giá BR-12, tiền thối, "Còn thiếu…" khóa
 * Hoàn tất), chuyển khoản (QR VietQR giả lập, "Đã nhận tiền"), thẻ (mã chuẩn chi, "Đã quẹt thành công").
 */
export function CheckoutDialog(props: CheckoutDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={(v) => !props.pending && props.onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl">{props.open && <CheckoutForm {...props} />}</DialogContent>
    </Dialog>
  )
}

function CheckoutForm({ amount, title, nextCode, store, pending, error, onSubmit }: CheckoutDialogProps) {
  const [method, setMethod] = useState<TenderMethod>('TienMat')
  const [cash, setCash] = useState<number | null>(amount)
  const [reference, setReference] = useState('')
  const suggestions = useMemo(() => cashSuggestions(amount), [amount])
  const missing = cashShortage(amount, cash)
  const change = cash !== null && cash >= amount ? cash - amount : 0
  const qrContent = useMemo(
    () => (store ? vietQrPayload(store, amount, nextCode ?? 'THANH TOAN') : ''),
    [store, amount, nextCode]
  )

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (pending) return
    if (method === 'TienMat') {
      if (cash === null || missing > 0) return
      onSubmit({ method, cashReceived: cash })
    } else if (method === 'ChuyenKhoan') {
      onSubmit({ method, reference: nextCode }, qrContent)
    } else {
      onSubmit({ method, reference: reference.trim() || undefined })
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title ?? 'Thanh toán'}</DialogTitle>
        <DialogDescription className="sr-only">Chọn phương thức, nhập tiền khách đưa rồi bấm Hoàn tất</DialogDescription>
      </DialogHeader>
      <div className="bg-primary/8 border-primary/20 flex items-baseline justify-between rounded-xl border px-4 py-3">
        <span className="text-muted-foreground text-sm font-medium">Khách cần trả</span>
        <span className="text-primary text-3xl font-bold tabular-nums">{formatVnd(amount)}</span>
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        value={method}
        onValueChange={(v) => v && setMethod(v as TenderMethod)}
        className="grid w-full grid-cols-3"
      >
        <ToggleGroupItem value="TienMat" className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-12 gap-2">
          <Banknote className="size-5" aria-hidden="true" /> Tiền mặt
        </ToggleGroupItem>
        <ToggleGroupItem value="ChuyenKhoan" className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-12 gap-2">
          <QrCode className="size-5" aria-hidden="true" /> Chuyển khoản
        </ToggleGroupItem>
        <ToggleGroupItem value="The" className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-12 gap-2">
          <CreditCard className="size-5" aria-hidden="true" /> Thẻ
        </ToggleGroupItem>
      </ToggleGroup>

      {method === 'TienMat' && (
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {suggestions.map((s) => (
              <Button
                key={s}
                type="button"
                variant={cash === s ? 'default' : 'outline'}
                className="h-12 text-base font-semibold tabular-nums"
                onClick={() => setCash(s)}
              >
                {new Intl.NumberFormat('vi-VN').format(s)}
              </Button>
            ))}
          </div>
          <FormField label="Tiền khách đưa" htmlFor="cash-received">
            <MoneyInput
              id="cash-received"
              autoFocus
              value={cash}
              onChange={setCash}
              onFocus={(e) => e.currentTarget.select()}
              className="h-14 text-2xl font-semibold"
            />
          </FormField>
          <div
            className={cn(
              'flex items-baseline justify-between rounded-lg px-4 py-2.5',
              missing > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
            )}
            aria-live="polite"
          >
            <span className="font-medium">{missing > 0 ? 'Còn thiếu' : 'Tiền thối'}</span>
            <span className="text-2xl font-bold tabular-nums">{formatVnd(missing > 0 ? missing : change)}</span>
          </div>
        </div>
      )}

      {method === 'ChuyenKhoan' && (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          {qrContent ? <QrImage value={qrContent} size={200} /> : null}
          <dl className="grid flex-1 gap-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Ngân hàng (BIN)</dt>
              <dd className="font-medium">{store?.bankBin}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Số tài khoản</dt>
              <dd className="font-medium tabular-nums">{store?.bankAccount}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Chủ tài khoản</dt>
              <dd className="font-medium">{store?.bankAccountName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Nội dung</dt>
              <dd className="font-semibold tabular-nums">{nextCode}</dd>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              QR giả lập để trình diễn. Kiểm tra app ngân hàng báo đã nhận rồi bấm &quot;Đã nhận tiền&quot;.
            </p>
          </dl>
        </div>
      )}

      {method === 'The' && (
        <FormField label="Mã chuẩn chi" htmlFor="card-ref" hint="Không bắt buộc">
          <Input
            id="card-ref"
            autoFocus
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={100}
            className="h-11"
          />
        </FormField>
      )}

      {error && (
        <div role="alert" className="border-destructive/30 bg-destructive/8 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        variant="cta"
        className="h-14 text-lg font-semibold"
        disabled={pending || (method === 'TienMat' && (cash === null || missing > 0))}
      >
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {method === 'TienMat' ? 'Hoàn tất' : method === 'ChuyenKhoan' ? 'Đã nhận tiền' : 'Đã quẹt thành công'}
        <Kbd className="ml-1">Enter</Kbd>
      </Button>
    </form>
  )
}
