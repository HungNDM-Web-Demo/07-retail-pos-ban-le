'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, FileSearch, Loader2, ReceiptText, ShieldCheck, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { permissions } from '@/config/permissions'
import { posRules } from '@/config/pos-rules'
import { routePath, routeTo } from '@/config/route-path'
import { refundMethodLabels, returnConditionLabels, returnReasonLabels } from '@/config/retail-pos-labels'
import { CheckoutDialog } from '@/features/pos/components/CheckoutDialog'
import { ManagerApprovalDialog } from '@/features/pos/components/ManagerApprovalDialog'
import { PosShell } from '@/features/pos/components/PosShell'
import { ProductImage } from '@/features/pos/components/ProductImage'
import { ScanBox, type ScanBoxHandle } from '@/features/pos/components/ScanBox'
import { invalidateAfterSale, useCatalog, useStoreProfile } from '@/features/pos/hooks/use-pos'
import { useScanner } from '@/features/pos/hooks/use-scanner'
import { buildCatalogIndex, type CatalogHit } from '@/features/pos/lib/cart'
import { parseScanInput } from '@/features/pos/lib/barcode'
import { priceCart, refundForLine } from '@/features/pos/lib/pricing'
import { printUrl } from '@/features/pos/lib/print'
import { problemCode } from '@/features/pos/lib/problem'
import { beepError, beepOk } from '@/features/pos/lib/sound'
import { orderService } from '@/features/orders/services/order.service'
import { useCurrentShift } from '@/features/shifts/hooks/use-shifts'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatDateTime, formatNumber, formatPhone, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  RefundMethod,
  ReturnCondition,
  ReturnReason,
  ReturnSourceOrder,
  TenderInput,
} from '@/types/retail-pos'
import { FindOrderDialog } from '../components/FindOrderDialog'
import { useCreateReturn, useReturnSource } from '../hooks/use-returns'

type LineInput = { qty: string; condition: ReturnCondition; reason: ReturnReason; note: string }
type ExchangeLine = { key: string; productId: string; unitId: string; quantity: number }

const BIG_REFUND_TEXT = 'Tiền hoàn trên 500.000 ₫, cần chủ cửa hàng xác nhận'
const toggleOn = 'data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'
const rid = () => Math.random().toString(36).slice(2, 10)

/**
 * Lập phiếu đổi trả `/returns/new` (SCR-05; UC-07, BR-17…BR-20): quét mã hóa đơn trên bill (Code 128) hoặc
 * "Tìm hóa đơn"; chọn số lượng trả, tình trạng, lý do; hàng đổi dùng lại ô quét của màn bán hàng.
 */
export function ReturnNewPage() {
  const qc = useQueryClient()
  const params = useSearchParams()
  const { can } = usePermissions()
  const shiftQuery = useCurrentShift()
  const shift = shiftQuery.data
  const store = useStoreProfile().data
  const catalogQuery = useCatalog(!!shift)
  const catalog = catalogQuery.data
  const index = useMemo(() => buildCatalogIndex(catalog), [catalog])

  const sourceMutation = useReturnSource()
  const create = useCreateReturn()
  const [source, setSource] = useState<ReturnSourceOrder | null>(null)
  const [inputs, setInputs] = useState<Record<string, LineInput>>({})
  const [exchange, setExchange] = useState<ExchangeLine[]>([])
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('TienMat')
  const [note, setNote] = useState('')
  const [codeText, setCodeText] = useState('')
  const [findOpen, setFindOpen] = useState(false)
  const [approval, setApproval] = useState<{ reasons: string[] } | null>(null)
  const approvalResolve = useRef<(token: string | null) => void>(() => undefined)
  const [payDiff, setPayDiff] = useState<{ amount: number; nextCode?: string; error?: string | null } | null>(null)
  const requestId = useRef<string>('')
  const codeInput = useRef<HTMLInputElement>(null)
  const exchangeScan = useRef<ScanBoxHandle>(null)

  const loadSource = useCallback(
    (code: string) => {
      const value = code.trim().toUpperCase()
      if (!value) return
      sourceMutation.mutate(value, {
        onSuccess: (s) => {
          beepOk()
          setSource(s)
          setInputs(
            Object.fromEntries(
              s.lines.map((l) => [l.orderLineId, { qty: '', condition: 'BanLaiDuoc', reason: 'KhachDoiY', note: '' }])
            )
          )
          setExchange([])
          setNote('')
          setCodeText('')
          requestId.current = crypto.randomUUID()
        },
        onError: (err) => {
          beepError()
          toast.error(getErrorMessage(err))
        },
      })
    },
    [sourceMutation]
  )

  // ?code= từ chi tiết hóa đơn
  const initial = params.get('code')
  const loadedInitial = useRef(false)
  useEffect(() => {
    if (initial && shift && !loadedInitial.current) {
      loadedInitial.current = true
      loadSource(initial)
    }
  }, [initial, shift, loadSource])

  // ───────────── Hàng đổi ─────────────
  const addExchange = (hit: CatalogHit, qty: number) => {
    if (hit.item.status !== 'DangBan') {
      beepError()
      toast.error('Hàng ngừng bán')
      return
    }
    setExchange((list) => {
      const found = list.find((l) => l.productId === hit.item.productId && l.unitId === hit.unit.unitId)
      if (found) return list.map((l) => (l === found ? { ...l, quantity: Math.min(posRules.maxLineQuantity, l.quantity + qty) } : l))
      return [...list, { key: rid(), productId: hit.item.productId, unitId: hit.unit.unitId, quantity: qty }]
    })
    beepOk()
  }
  const scanExchange = (code: string, qty = 1) => {
    const hit = index.byBarcode.get(code)
    if (!hit) {
      beepError()
      toast.error(`Không tìm thấy mã vạch ${code}`)
      return
    }
    addExchange(hit, qty)
  }

  const anyDialog = findOpen || !!approval || !!payDiff
  useScanner((code) => {
    if (!source) loadSource(code)
    else scanExchange(code)
  }, !!shift && !anyDialog)

  // ───────────── Tính tiền (§3.6) ─────────────
  const lineCalc = useMemo(() => {
    if (!source) return []
    return source.lines.map((l, i) => {
      const input = inputs[l.orderLineId]
      const qty = input?.qty ? Number(input.qty) : 0
      const over = qty > l.returnableQty
      const refund = qty > 0 && !over ? refundForLine(l, qty) : 0
      return { line: l, input, qty, over, refund, index: i }
    })
  }, [source, inputs])
  const chosen = lineCalc.filter((c) => c.qty > 0)
  const hasOver = lineCalc.some((c) => c.over)
  const refundTotal = chosen.reduce((s, c) => s + c.refund, 0)
  const exchangePriced = useMemo(
    () => priceCart(exchange.map((l) => ({ productId: l.productId, unitId: l.unitId, quantity: l.quantity })), index.lookup),
    [exchange, index]
  )
  const exchangeTotal = exchangePriced.total
  const difference = exchangeTotal - refundTotal
  const offset = Math.min(refundTotal, exchangeTotal)
  const payout = refundTotal - offset
  const reasons = [
    ...(source?.needsApproval && source.approvalText ? [source.approvalText] : []),
    ...(refundTotal > posRules.refundApprovalThreshold ? [BIG_REFUND_TEXT] : []),
  ]
  const cashWarning = refundMethod === 'TienMat' && !!shift && payout > shift.expectedCash
  const missingNote = chosen.some((c) => c.input?.reason === 'Khac' && !c.input.note.trim())
  const canSubmit = !!source && chosen.length > 0 && !hasOver && !missingNote && !create.isPending

  const setInput = (id: string, patch: Partial<LineInput>) =>
    setInputs((all) => ({ ...all, [id]: { ...all[id], ...patch } }))

  const reset = () => {
    setSource(null)
    setInputs({})
    setExchange([])
    setNote('')
    setRefundMethod('TienMat')
    setTimeout(() => codeInput.current?.focus(), 0)
  }

  // ───────────── Hoàn tất ─────────────
  const askApproval = (texts: string[]) =>
    new Promise<string | null>((resolve) => {
      approvalResolve.current = resolve
      setApproval({ reasons: texts })
    })
  const tokenRef = useRef<string | undefined>(undefined)

  const submit = async () => {
    if (!source || !canSubmit) return
    tokenRef.current = undefined
    if (reasons.length) {
      const t = await askApproval(reasons)
      if (!t) return
      tokenRef.current = t
    }
    if (exchange.length && difference > 0) {
      const next = await orderService.nextCode().catch(() => undefined)
      setPayDiff({ amount: difference, nextCode: next?.code })
      return
    }
    doCreate(null)
  }

  const doCreate = (payment: { tender: TenderInput; qr?: string } | null) => {
    if (!source) return
    create.mutate(
      {
        clientRequestId: requestId.current,
        orderId: source.orderId,
        lines: chosen.map((c) => ({
          orderLineId: c.line.orderLineId,
          quantity: c.qty,
          condition: c.input!.condition,
          reason: c.input!.reason,
          note: c.input!.note.trim() || undefined,
        })),
        refundMethod,
        note: note.trim() || undefined,
        approvalToken: tokenRef.current,
        expectedRefundTotal: refundTotal,
        exchange: exchange.length
          ? {
              lines: exchange.map((l) => ({ productId: l.productId, unitId: l.unitId, quantity: l.quantity })),
              expectedTotal: exchangeTotal,
              payment: payment?.tender,
              qrContent: payment?.qr,
            }
          : undefined,
      },
      {
        onSuccess: (r) => {
          setPayDiff(null)
          toast.success(`Đã lập phiếu ${r.code}`, {
            description:
              r.payoutAmount > 0
                ? `Trả khách ${formatVnd(r.payoutAmount)} bằng ${refundMethodLabels[r.refundMethod].toLowerCase()}`
                : undefined,
          })
          printUrl(routeTo.returnReceipt(r.id))
          if (r.exchangeOrder) printUrl(routeTo.orderReceipt(r.exchangeOrder.id))
          invalidateAfterSale(qc)
          reset()
        },
        onError: (err) => {
          const code = problemCode(err)
          const message = Object.values(getFieldErrors(err))[0] ?? getErrorMessage(err)
          if (payment) setPayDiff((s) => (s ? { ...s, error: message } : s))
          else toast.error(message)
          if (code === 'TongTienDaDoi') loadSource(source.code)
        },
      }
    )
  }

  // ───────────── Giao diện ─────────────
  if (!shiftQuery.isLoading && !shift) {
    return (
      <PosShell shift={null}>
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <Undo2 className="text-muted-foreground size-10" aria-hidden="true" />
          <p className="text-lg font-semibold">Mở ca trước khi đổi trả</p>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={routePath.returns}>Về danh sách đổi trả</Link>
            </Button>
            {can(permissions.shifts.operate) && (
              <Button asChild>
                <Link href={routePath.shiftsCurrent}>Mở ca</Link>
              </Button>
            )}
          </div>
        </div>
      </PosShell>
    )
  }

  return (
    <PosShell
      shift={shift}
      center={
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Undo2 className="size-4" aria-hidden="true" /> Lập phiếu đổi trả
        </span>
      }
    >
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_20rem] gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          {/* Hóa đơn gốc */}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              loadSource(codeText)
            }}
          >
            <div className="relative flex-1">
              <ReceiptText className="text-primary pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" aria-hidden="true" />
              <Input
                ref={codeInput}
                autoFocus
                value={codeText}
                onChange={(e) => setCodeText(e.target.value)}
                placeholder="Quét mã vạch trên hóa đơn hoặc gõ mã HD… rồi Enter"
                aria-label="Mã hóa đơn gốc"
                className="h-12 rounded-xl border-2 pl-12 text-lg"
                autoComplete="off"
              />
            </div>
            <Button type="submit" className="h-12" disabled={sourceMutation.isPending}>
              {sourceMutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Mở hóa đơn
            </Button>
            <Button type="button" variant="outline" className="h-12" onClick={() => setFindOpen(true)}>
              <FileSearch aria-hidden="true" /> Tìm hóa đơn
            </Button>
          </form>

          {!source ? (
            <div className="bg-card text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border p-6 text-center">
              <ReceiptText className="size-10 opacity-40" aria-hidden="true" />
              <p className="font-medium">Quét mã vạch trên hóa đơn của khách</p>
              <p className="max-w-md text-sm">
                Khách mất hóa đơn: bấm &quot;Tìm hóa đơn&quot; để lọc theo ngày mua, mặt hàng (hóa đơn trong 30 ngày).
              </p>
            </div>
          ) : (
            <>
              <div className="bg-card rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-base font-semibold tabular-nums">{source.code}</span>
                  <span>{formatDateTime(source.paidAt)}</span>
                  <span className="text-muted-foreground">
                    {source.daysSince === 0 ? 'hôm nay' : `${source.daysSince} ngày trước`} · {source.cashierName}
                  </span>
                  <span className="font-medium tabular-nums">{formatVnd(source.total)}</span>
                  {source.customer && (
                    <span className="text-muted-foreground">
                      {source.customer.name} · {formatPhone(source.customer.phone)}
                    </span>
                  )}
                  <Button variant="ghost" size="sm" className="ml-auto" onClick={reset}>
                    Đổi hóa đơn khác
                  </Button>
                </div>
                {source.needsApproval && (
                  <p className="text-warning mt-2 flex items-center gap-1.5 text-sm font-medium">
                    <AlertTriangle className="size-4" aria-hidden="true" /> {source.approvalText}
                  </p>
                )}
              </div>
              <div className="bg-card overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/70 text-muted-foreground text-xs font-semibold uppercase">
                    <tr>
                      <th className="px-2 py-2 text-left">Hàng</th>
                      <th className="px-2 py-2 text-right">Đã mua</th>
                      <th className="px-2 py-2 text-right">Đã trả</th>
                      <th className="px-2 py-2 text-right">Còn trả</th>
                      <th className="px-2 py-2 text-right">Đơn giá thực thu</th>
                      <th className="w-24 px-2 py-2 text-right">SL trả</th>
                      <th className="px-2 py-2 text-left">Tình trạng, lý do</th>
                      <th className="px-2 py-2 text-right">Tiền hoàn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineCalc.map(({ line, input, over, refund }) => {
                      const disabled = !line.returnable || line.returnableQty <= 0
                      return (
                        <tr key={line.orderLineId} className={cn('border-t align-top', disabled && 'opacity-55')}>
                          <td className="px-2 py-2">
                            <p className="font-medium">{line.productName}</p>
                            <p className="text-muted-foreground text-xs">
                              {line.unitName}
                              {!line.returnable && ' · Hàng không đổi trả'}
                            </p>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">{line.quantity}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{line.returnedQty}</td>
                          <td className="px-2 py-2 text-right font-semibold tabular-nums">{line.returnableQty}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{formatNumber(line.unitNetPrice, 0)}</td>
                          <td className="px-2 py-2">
                            <input
                              inputMode="numeric"
                              aria-label={`Số lượng trả ${line.productName}`}
                              disabled={disabled}
                              value={input?.qty ?? ''}
                              onChange={(e) => setInput(line.orderLineId, { qty: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                              placeholder="0"
                              aria-invalid={over || undefined}
                              className={cn(
                                'border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-2 text-right font-semibold tabular-nums focus-visible:ring-3 focus-visible:outline-none',
                                over && 'border-destructive text-destructive'
                              )}
                            />
                            {over && <p className="text-destructive mt-0.5 text-right text-xs font-medium">Tối đa {line.returnableQty}</p>}
                          </td>
                          <td className="px-2 py-2">
                            {!disabled && (
                              <div className="grid gap-1">
                                <select
                                  aria-label="Tình trạng"
                                  value={input?.condition}
                                  onChange={(e) => setInput(line.orderLineId, { condition: e.target.value as ReturnCondition })}
                                  className="border-input bg-background h-8 rounded-md border px-1.5 text-xs"
                                >
                                  {Object.entries(returnConditionLabels).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  aria-label="Lý do"
                                  value={input?.reason}
                                  onChange={(e) => setInput(line.orderLineId, { reason: e.target.value as ReturnReason })}
                                  className="border-input bg-background h-8 rounded-md border px-1.5 text-xs"
                                >
                                  {Object.entries(returnReasonLabels).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                                {input?.reason === 'Khac' && (
                                  <input
                                    aria-label="Ghi chú lý do"
                                    value={input.note}
                                    onChange={(e) => setInput(line.orderLineId, { note: e.target.value })}
                                    placeholder="Ghi chú (bắt buộc)"
                                    className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                                  />
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold tabular-nums">{refund ? formatVnd(refund) : ''}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Hàng đổi */}
              <div className="bg-card grid gap-2 rounded-xl border p-3">
                <p className="text-sm font-semibold">Hàng đổi (giá hiện hành, không giảm giá)</p>
                <ScanBox
                  ref={exchangeScan}
                  catalog={catalog}
                  onClearPending={() => undefined}
                  onSubmitText={(text) => {
                    const parsed = parseScanInput(text)
                    if (parsed.error) toast.error(parsed.error)
                    if (parsed.code) scanExchange(parsed.code, parsed.prefixQty ?? 1)
                  }}
                  onPick={(hit, text) => addExchange(hit, parseScanInput(text).prefixQty ?? 1)}
                  onArrow={() => undefined}
                  onDeleteLine={() => undefined}
                />
                {exchange.length > 0 && (
                  <ul className="divide-y text-sm">
                    {exchange.map((l, i) => {
                      const item = index.byProduct.get(l.productId)
                      const priced = exchangePriced.lines[i]
                      return (
                        <li key={l.key} className="flex items-center gap-3 py-2">
                          <ProductImage name={item?.name ?? '?'} imageUrl={item?.imageUrl} color={item?.color} size="xs" />
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {item?.name} – {priced?.unitName}
                          </span>
                          <input
                            inputMode="numeric"
                            aria-label={`Số lượng đổi ${item?.name}`}
                            value={l.quantity}
                            onChange={(e) => {
                              const q = Math.max(1, Math.min(posRules.maxLineQuantity, Number(e.target.value.replace(/\D/g, '')) || 1))
                              setExchange((list) => list.map((x) => (x.key === l.key ? { ...x, quantity: q } : x)))
                            }}
                            className="border-input bg-background h-8 w-16 rounded-md border px-2 text-right tabular-nums"
                          />
                          <span className="w-28 text-right font-semibold tabular-nums">{formatVnd(priced?.amount ?? 0)}</span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Bỏ ${item?.name}`}
                            onClick={() => setExchange((list) => list.filter((x) => x.key !== l.key))}
                          >
                            <Trash2 />
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>

        {/* Tổng */}
        <aside className="bg-card flex min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border p-3">
          <dl className="grid gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tiền hoàn</dt>
              <dd className="text-base font-semibold tabular-nums">{formatVnd(refundTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Hàng đổi</dt>
              <dd className="tabular-nums">{formatVnd(exchangeTotal)}</dd>
            </div>
            {exchange.length > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Bù trừ đổi hàng</dt>
                <dd className="tabular-nums">{formatVnd(offset)}</dd>
              </div>
            )}
          </dl>
          <div className={cn('rounded-xl border px-3 py-3', difference > 0 ? 'bg-cta/8 border-cta/30' : 'bg-primary/8 border-primary/20')}>
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {difference > 0 ? 'Khách trả thêm' : 'Trả lại khách'}
            </p>
            <p className={cn('text-right text-4xl leading-tight font-bold tabular-nums', difference > 0 ? 'text-cta' : 'text-primary')}>
              {formatVnd(difference > 0 ? difference : payout)}
            </p>
          </div>
          {payout > 0 && (
            <FormField label="Hình thức trả lại khách" htmlFor="refund-method">
              <ToggleGroup
                id="refund-method"
                type="single"
                variant="outline"
                value={refundMethod}
                onValueChange={(v) => v && setRefundMethod(v as RefundMethod)}
                className="grid w-full grid-cols-2"
              >
                <ToggleGroupItem value="TienMat" className={cn('h-10', toggleOn)}>
                  Tiền mặt
                </ToggleGroupItem>
                <ToggleGroupItem value="ChuyenKhoan" className={cn('h-10', toggleOn)}>
                  Chuyển khoản
                </ToggleGroupItem>
              </ToggleGroup>
            </FormField>
          )}
          {cashWarning && (
            <p className="text-warning flex items-start gap-1.5 text-sm font-medium">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Tiền mặt trong két có thể không đủ, nên hoàn bằng chuyển khoản
            </p>
          )}
          {reasons.length > 0 && (
            <ul className="text-warning grid gap-1 text-sm font-medium">
              {reasons.map((r) => (
                <li key={r} className="flex items-start gap-1.5">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {r}
                </li>
              ))}
            </ul>
          )}
          <FormField label="Ghi chú phiếu" htmlFor="return-note">
            <Textarea id="return-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </FormField>
          {missingNote && <p className="text-destructive text-sm">Nhập ghi chú cho dòng có lý do &quot;Khác&quot;</p>}
          <Button variant="cta" className="mt-auto h-14 text-lg font-bold" disabled={!canSubmit} onClick={() => void submit()}>
            {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Hoàn tất đổi trả
          </Button>
        </aside>
      </div>

      <FindOrderDialog
        open={findOpen}
        onOpenChange={setFindOpen}
        catalog={catalog}
        onPick={(code) => {
          setFindOpen(false)
          loadSource(code)
        }}
      />
      <ManagerApprovalDialog
        open={!!approval}
        onOpenChange={(open) => {
          if (!open) {
            approvalResolve.current(null)
            approvalResolve.current = () => undefined
            setApproval(null)
          }
        }}
        action="DoiTra"
        reasons={approval?.reasons ?? []}
        onApproved={(a) => {
          approvalResolve.current(a.token)
          approvalResolve.current = () => undefined
          setApproval(null)
        }}
      />
      <CheckoutDialog
        open={!!payDiff}
        onOpenChange={(open) => {
          if (!open && !create.isPending) setPayDiff(null)
        }}
        title="Thu phần chênh lệch đổi hàng"
        amount={payDiff?.amount ?? 0}
        nextCode={payDiff?.nextCode}
        store={store}
        pending={create.isPending}
        error={payDiff?.error}
        onSubmit={(tender, qr) => doCreate({ tender, qr })}
      />
    </PosShell>
  )
}
