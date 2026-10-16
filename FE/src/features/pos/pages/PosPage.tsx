'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LogIn, Percent, Plus, ShieldCheck, Tag, Trash2, UserRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { posRules } from '@/config/pos-rules'
import { posHotkeys } from '@/config/retail-pos-labels'
import { routeTo } from '@/config/route-path'
import { orderService } from '@/features/orders/services/order.service'
import { OpenShiftForm } from '@/features/shifts/components/OpenShiftForm'
import { useCurrentShift } from '@/features/shifts/hooks/use-shifts'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage, isApiError } from '@/lib/api-error'
import { formatNumber, formatPhone, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ApprovalReason, CartInput, DiscountInput, OrderQuote, TenderInput } from '@/types/retail-pos'
import { CartTable, type CartRow } from '../components/CartTable'
import { CheckoutDialog } from '../components/CheckoutDialog'
import { CustomerDialog } from '../components/CustomerDialog'
import { DiscountDialog, type DiscountScope } from '../components/DiscountDialog'
import { Kbd } from '../components/Kbd'
import { ManagerApprovalDialog } from '../components/ManagerApprovalDialog'
import { PosShell } from '../components/PosShell'
import { PriceCheckDialog } from '../components/PriceCheckDialog'
import { SampleBarcodesDialog } from '../components/SampleBarcodesDialog'
import { ScanBox, type ScanBoxHandle } from '../components/ScanBox'
import { invalidateAfterSale, useCatalog, useCheckout, useQuote, useStoreProfile } from '../hooks/use-pos'
import { useScanner } from '../hooks/use-scanner'
import { parseScanInput } from '../lib/barcode'
import { addToTab, baseQtyByProduct, buildCatalogIndex, shortageOf, type CatalogHit } from '../lib/cart'
import { problemCode, problemExtra } from '../lib/problem'
import { priceCart } from '../lib/pricing'
import { printUrl } from '../lib/print'
import { beepError, beepOk } from '../lib/sound'
import { overStockText } from '../lib/stock-math'
import { useActiveTab, useHeldTabs, type HeldTab } from '../stores/held-tabs.store'

type DialogName = 'discount' | 'price' | 'customer' | 'checkout' | 'sample' | 'openShift' | 'clear' | null
type ApprovalAsk = { reasons: ApprovalReason[] }
type CheckoutState = {
  amount: number
  nextCode?: string
  requestId: string
  signature: string
  error?: string | null
}

const toCartInput = (tab: HeldTab): CartInput => ({
  lines: tab.lines.map((l) => ({ productId: l.productId, unitId: l.unitId, quantity: l.quantity, discount: l.discount })),
  orderDiscount: tab.orderDiscount,
  customerId: tab.customer?.id,
})
const cartSignature = (tab: HeldTab) =>
  JSON.stringify([tab.lines.map((l) => [l.productId, l.unitId, l.quantity, l.discount]), tab.orderDiscount, tab.customer?.id])
const sameCodes = (a: string[], b: string[]) => a.length === b.length && a.every((c) => b.includes(c))

/**
 * Màn bán hàng `/pos` (SCR-02, SCR-03; UC-03…UC-06, FR-08…FR-20). Dùng hoàn toàn bằng bàn phím: ô quét luôn
 * có con trỏ, phím tắt F2–F9, máy quét thật hoặc giả lập (07 §4.2, §4.3, §4.4).
 */
export function PosPage() {
  const qc = useQueryClient()
  const { user, can } = usePermissions()
  const shiftQuery = useCurrentShift()
  const shift = shiftQuery.data
  const hasShift = !!shift
  const catalogQuery = useCatalog(hasShift)
  const catalog = catalogQuery.data
  const store = useStoreProfile().data
  const index = useMemo(() => buildCatalogIndex(catalog), [catalog])

  const held = useHeldTabs()
  const tab = useActiveTab()
  const initHeld = held.init
  useEffect(() => {
    if (user?.id) initHeld(user.id)
  }, [user?.id, initHeld])

  const scan = useRef<ScanBoxHandle>(null)
  // Trả con trỏ về ô quét (bỏ qua khi đang có hộp thoại mở để không cướp con trỏ của hộp)
  const refocus = useCallback(() => {
    setTimeout(() => {
      if (!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) scan.current?.focus()
    }, 0)
  }, [])
  const [selectedKey, setSelectedKey] = useState<string | undefined>()
  const [pendingQty, setPendingQty] = useState<number | null>(null)
  const [dialog, setDialog] = useState<DialogName>(null)
  const [approvalAsk, setApprovalAsk] = useState<ApprovalAsk | null>(null)
  const approvalResolve = useRef<(r: { token: string; by: string } | null) => void>(() => undefined)
  const anyDialog = dialog !== null || approvalAsk !== null

  // Chưa mở ca: tự mở hộp Mở ca một lần (TC-05, TC-06)
  const askedOpen = useRef(false)
  useEffect(() => {
    if (shiftQuery.isSuccess && !shift && !askedOpen.current && can(permissions.shifts.operate)) {
      askedOpen.current = true
      setDialog('openShift')
    }
  }, [shiftQuery.isSuccess, shift, can])

  // ───────────── Tính tiền tại máy (chưa có giá vốn) ─────────────
  const priced = useMemo(() => priceCart(toCartInput(tab).lines, index.lookup, tab.orderDiscount), [tab, index])
  const need = useMemo(() => baseQtyByProduct(tab.lines, index), [tab.lines, index])
  const rows: CartRow[] = useMemo(() => {
    let p = 0
    return tab.lines.map((line) => {
      const ok = !!index.lookup(line.productId, line.unitId)
      return { line, priced: ok ? priced.lines[p++] : undefined, shortage: shortageOf(line.productId, need, index) }
    })
  }, [tab.lines, priced, need, index])
  const overStock = useMemo(() => {
    const seen = new Set<string>()
    return rows.filter((r) => {
      if (r.shortage <= 0 || seen.has(r.line.productId)) return false
      seen.add(r.line.productId)
      return true
    })
  }, [rows])
  const selected = rows.find((r) => r.line.key === selectedKey) ?? rows[rows.length - 1]
  /** Tắt "Cho phép bán âm kho" mà còn dòng vượt tồn → khóa Thanh toán (BR-10, TC-19) */
  const stockBlocked = overStock.length > 0 && store?.allowNegativeStock === false
  const totalQty = tab.lines.reduce((s, l) => s + l.quantity, 0)

  // ───────────── Thêm hàng ─────────────
  const addHit = useCallback(
    (hit: CatalogHit, qty: number) => {
      if (hit.item.status !== 'DangBan') {
        beepError()
        toast.error('Hàng ngừng bán', { description: hit.item.name })
        setPendingQty(null)
        return
      }
      const current = useHeldTabs.getState()
      const active = current.tabs.find((t) => t.id === current.activeId) ?? current.tabs[0]
      const result = addToTab(active, hit.item.productId, hit.unit.unitId, qty)
      current.updateActive(() => result.tab)
      setSelectedKey(result.key)
      setPendingQty(null)
      beepOk()
    },
    []
  )

  const handleCode = useCallback(
    (code: string, qty?: number) => {
      if (!hasShift) {
        beepError()
        toast.error('Chưa mở ca, mở ca trước khi bán hàng')
        return
      }
      const hit = index.byBarcode.get(code)
      if (!hit) {
        beepError()
        toast.error(`Không tìm thấy mã vạch ${code}`)
        setPendingQty(null)
        return
      }
      addHit(hit, qty ?? pendingQty ?? 1)
    },
    [hasShift, index, addHit, pendingQty]
  )

  const handleText = (text: string) => {
    const parsed = parseScanInput(text)
    if (parsed.error) {
      beepError()
      toast.error(parsed.error)
      setPendingQty(null)
    }
    if (parsed.prefixQty && !parsed.code && !parsed.search) setPendingQty(parsed.prefixQty)
    if (parsed.code) handleCode(parsed.code, parsed.prefixQty)
    else if (parsed.search) {
      beepError()
      toast.error(`Không tìm thấy mã vạch ${parsed.search}`)
    }
  }

  const pickHit = (hit: CatalogHit, text: string) => {
    const parsed = parseScanInput(text)
    if (parsed.error) {
      beepError()
      toast.error(parsed.error)
    }
    addHit(hit, parsed.prefixQty ?? pendingQty ?? 1)
  }

  useScanner((code) => {
    handleCode(code)
    refocus()
  }, !anyDialog)

  // ───────────── Sửa giỏ ─────────────
  const setQuantity = (key: string, quantity: number) =>
    held.updateActive((t) => ({ ...t, lines: t.lines.map((l) => (l.key === key ? { ...l, quantity } : l)) }))
  // Đổi đơn vị giữ số lượng, xóa giảm dòng (quyết định 17)
  const setUnit = (key: string, unitId: string) =>
    held.updateActive((t) => ({
      ...t,
      lines: t.lines.map((l) => (l.key === key ? { ...l, unitId, discount: undefined } : l)),
    }))
  const removeLine = (key: string) => {
    const i = tab.lines.findIndex((l) => l.key === key)
    held.updateActive((t) => ({ ...t, lines: t.lines.filter((l) => l.key !== key) }))
    setSelectedKey((tab.lines[i + 1] ?? tab.lines[i - 1])?.key)
  }
  const moveSelection = (dir: 1 | -1) => {
    if (!tab.lines.length) return
    const i = tab.lines.findIndex((l) => l.key === selected?.line.key)
    const next = Math.min(tab.lines.length - 1, Math.max(0, (i < 0 ? tab.lines.length : i) + dir))
    setSelectedKey(tab.lines[next].key)
  }

  // ───────────── Xác nhận của chủ cửa hàng (§3.4) ─────────────
  const askApproval = (reasons: ApprovalReason[]) =>
    new Promise<{ token: string; by: string } | null>((resolve) => {
      approvalResolve.current = resolve
      setApprovalAsk({ reasons })
    })

  // ───────────── Giảm giá F8 (UC-05) ─────────────
  const quote = useQuote()
  const applyDiscount = (scope: DiscountScope, discount: DiscountInput | undefined) => {
    const target = selected?.line.key
    const candidate: HeldTab =
      scope === 'order'
        ? { ...tab, orderDiscount: discount }
        : { ...tab, lines: tab.lines.map((l) => (l.key === target ? { ...l, discount } : l)) }
    quote.mutate(toCartInput(candidate), {
      onSuccess: async (q) => {
        setDialog(null)
        if (!q.needsApproval) {
          held.updateActive(() => ({ ...candidate, approval: undefined }))
          return
        }
        const ok = await askApproval(q.approvalReasons)
        if (ok) {
          held.updateActive(() => ({
            ...candidate,
            approval: { token: ok.token, approvedByName: ok.by, reasonCodes: q.approvalReasons.map((r) => r.code) },
          }))
          toast.success(`Đã áp giảm giá, ${ok.by} xác nhận`)
        }
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    })
  }

  // UC-05 E3: giỏ đổi sau khi đã duyệt → quote lại; tập lý do khác lúc duyệt thì gỡ giảm giá
  const signature = cartSignature(tab)
  useEffect(() => {
    const approval = tab.approval
    if (!approval || !tab.lines.length) return
    const input = toCartInput(tab)
    const t = setTimeout(() => {
      orderService
        .quote(input)
        .then((q) => {
          const codes = q.approvalReasons.map((r) => r.code)
          if (!codes.length) {
            useHeldTabs.getState().updateActive((cur) => ({ ...cur, approval: undefined }))
          } else if (!sameCodes(codes, approval.reasonCodes)) {
            useHeldTabs.getState().updateActive((cur) => ({
              ...cur,
              orderDiscount: undefined,
              approval: undefined,
              lines: cur.lines.map((l) => ({ ...l, discount: undefined })),
            }))
            toast.warning('Hóa đơn đã thay đổi, giảm giá cần xác nhận lại')
          }
        })
        .catch(() => undefined)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi giỏ đổi
  }, [signature])

  // ───────────── Thanh toán F9 (UC-06) ─────────────
  const checkout = useCheckout()
  const [checkoutState, setCheckoutState] = useState<CheckoutState | null>(null)
  const requestIds = useRef(new Map<string, string>())

  const startCheckout = async () => {
    if (!hasShift || quote.isPending) return
    if (!tab.lines.length) {
      beepError()
      toast.error('Hóa đơn chưa có hàng')
      return
    }
    if (stockBlocked) {
      beepError()
      const item = index.byProduct.get(overStock[0].line.productId)
      toast.error(`${overStockText(overStock[0].shortage, item?.baseUnit ?? '')}: ${item?.name ?? ''}`)
      return
    }
    let q: OrderQuote
    try {
      q = await quote.mutateAsync(toCartInput(tab))
    } catch (err) {
      toast.error(getErrorMessage(err))
      return
    }
    let current = tab
    if (q.needsApproval) {
      const codes = q.approvalReasons.map((r) => r.code)
      if (!tab.approval || !sameCodes(codes, tab.approval.reasonCodes)) {
        const ok = await askApproval(q.approvalReasons)
        if (!ok) return
        current = { ...tab, approval: { token: ok.token, approvedByName: ok.by, reasonCodes: codes } }
        held.updateActive(() => current)
      }
    }
    // clientRequestId giữ nguyên khi bấm lại, đổi khi giỏ đổi (NFR-06)
    const sig = cartSignature(current)
    let requestId = requestIds.current.get(sig)
    if (!requestId) {
      requestId = crypto.randomUUID()
      requestIds.current.set(sig, requestId)
    }
    const next = await orderService.nextCode().catch(() => undefined)
    setCheckoutState({ amount: q.total, nextCode: next?.code, requestId, signature: sig, error: null })
    setDialog('checkout')
  }

  const submitCheckout = (payment: TenderInput, qrContent?: string) => {
    if (!checkoutState) return
    const state = checkoutState
    const current = useHeldTabs.getState()
    const active = current.tabs.find((t) => t.id === current.activeId) ?? current.tabs[0]
    checkout.mutate(
      {
        ...toCartInput(active),
        clientRequestId: state.requestId,
        payment,
        approvalToken: active.approval?.token,
        expectedTotal: state.amount,
        qrContent,
      },
      {
        onSuccess: (order) => {
          if (payment.method === 'TienMat') {
            toast.success('Đã mở két', { description: `${order.code} · thối ${formatVnd(order.payments[0]?.changeAmount ?? 0)}` })
          } else {
            toast.success(`Đã thanh toán ${order.code}`)
          }
          printUrl(routeTo.orderReceipt(order.id))
          requestIds.current.delete(state.signature)
          held.removeTab(active.id)
          setSelectedKey(undefined)
          setDialog(null)
          setCheckoutState(null)
          invalidateAfterSale(qc)
        },
        onError: (err) => {
          const code = problemCode(err)
          if (isApiError(err) && err.status === 0) {
            setCheckoutState((s) => s && { ...s, error: 'Chưa lưu được hóa đơn, thử lại' })
          } else if (code === 'TongTienDaDoi') {
            const total = problemExtra<number>(err, 'serverTotal')
            void qc.invalidateQueries({ queryKey: ['pos-catalog'] })
            setCheckoutState((s) => s && { ...s, amount: total ?? s.amount, error: getErrorMessage(err) })
          } else if (code === 'CanXacNhan' || code === 'MaXacNhanKhongHopLe') {
            held.updateActive((t) => ({ ...t, approval: undefined }))
            setDialog(null)
            setCheckoutState(null)
            toast.error(getErrorMessage(err))
          } else {
            setCheckoutState((s) => s && { ...s, error: getErrorMessage(err) })
          }
        },
      }
    )
  }

  // ───────────── Phím tắt (NFR-01) ─────────────
  const onHotkey = (e: KeyboardEvent) => {
    const fKeys: string[] = Object.values(posHotkeys)
    if (!fKeys.includes(e.key)) return
    // Chặn hành vi mặc định của trình duyệt (F3 tìm trang…); F5 không chặn
    e.preventDefault()
    if (anyDialog || !hasShift) return
    switch (e.key) {
      case posHotkeys.search:
        scan.current?.openSearch()
        break
      case posHotkeys.priceCheck:
        setDialog('price')
        break
      case posHotkeys.customer:
        if (can(permissions.customers.view)) setDialog('customer')
        break
      case posHotkeys.newTab:
        if (held.addTab()) setSelectedKey(undefined)
        else {
          beepError()
          toast.error('Tối đa 5 hóa đơn chờ')
        }
        refocus()
        break
      case posHotkeys.nextTab:
        held.nextTab()
        setSelectedKey(undefined)
        refocus()
        break
      case posHotkeys.discount:
        if (tab.lines.length && can(permissions.orders.discount)) setDialog('discount')
        break
      case posHotkeys.checkout:
        void startCheckout()
        break
    }
  }
  const hotkeyRef = useRef(onHotkey)
  useEffect(() => {
    hotkeyRef.current = onHotkey
  })
  useEffect(() => {
    const listener = (e: KeyboardEvent) => hotkeyRef.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  // Đóng mọi hộp → con trỏ về ô quét
  useEffect(() => {
    if (!anyDialog && hasShift) refocus()
  }, [anyDialog, hasShift, refocus])

  const closeDialog = (open: boolean) => {
    if (!open) setDialog(null)
  }

  // ───────────── Giao diện ─────────────
  const tabsBar = (
    <>
      {held.tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => {
            held.selectTab(t.id)
            setSelectedKey(undefined)
            refocus()
          }}
          aria-pressed={t.id === tab.id}
          className={cn(
            'focus-visible:ring-ring/50 flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:outline-none',
            t.id === tab.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
          )}
        >
          {t.name}
          {t.lines.length > 0 && (
            <span
              className={cn(
                'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums',
                t.id === tab.id ? 'bg-primary-foreground/20' : 'bg-muted-foreground/15'
              )}
            >
              {t.lines.length}
            </span>
          )}
        </button>
      ))}
      <Button
        variant="ghost"
        className="h-10 shrink-0 px-2.5"
        onClick={() => {
          if (held.addTab()) setSelectedKey(undefined)
          else toast.error('Tối đa 5 hóa đơn chờ')
          refocus()
        }}
        aria-label="Hóa đơn chờ mới"
        title={`Hóa đơn chờ mới (tối đa ${posRules.maxHeldTabs})`}
      >
        <Plus aria-hidden="true" />
        <Kbd>F6</Kbd>
      </Button>
    </>
  )

  if (shiftQuery.isLoading) {
    return (
      <div className="grid h-svh grid-cols-[1fr_22rem] gap-3 p-3">
        <Skeleton className="h-full" />
        <Skeleton className="h-full" />
      </div>
    )
  }

  return (
    <PosShell shift={shift} center={hasShift ? tabsBar : null} onSampleBarcodes={() => setDialog('sample')}>
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_20rem] gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Trái: ô quét + giỏ */}
        <section
          className="flex min-h-0 flex-col gap-3"
          aria-label="Hóa đơn đang bán"
          onPointerUp={(e) => {
            const el = e.target as HTMLElement
            if (!el.closest('input,select,button,textarea,a,[role=option]')) refocus()
          }}
        >
          <ScanBox
            ref={scan}
            catalog={catalog}
            disabled={!hasShift}
            pendingQty={pendingQty}
            onClearPending={() => setPendingQty(null)}
            onSubmitText={handleText}
            onPick={pickHit}
            onArrow={moveSelection}
            onDeleteLine={() => selected && removeLine(selected.line.key)}
          />
          <div className="bg-card relative min-h-0 flex-1 overflow-auto rounded-xl border">
            {hasShift ? (
              catalogQuery.isLoading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <CartTable
                  rows={rows}
                  index={index}
                  selectedKey={selected?.line.key}
                  onSelect={setSelectedKey}
                  onQuantity={setQuantity}
                  onUnit={setUnit}
                  onRemove={removeLine}
                  onDone={refocus}
                />
              )
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="text-lg font-semibold">Chưa mở ca</p>
                <p className="text-muted-foreground max-w-sm text-sm">
                  Mở ca với tiền đầu ca trong két để bắt đầu bán hàng.
                </p>
                {can(permissions.shifts.operate) && (
                  <Button size="lg" onClick={() => setDialog('openShift')}>
                    <LogIn aria-hidden="true" /> Mở ca
                  </Button>
                )}
              </div>
            )}
          </div>
          <p className="text-muted-foreground hidden items-center gap-4 text-xs lg:flex" aria-hidden="true">
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> chọn dòng
            </span>
            <span>
              <Kbd>Del</Kbd> xóa dòng
            </span>
            <span>
              <Kbd>F7</Kbd> hóa đơn chờ kế tiếp
            </span>
            <span>
              <Kbd>Esc</Kbd> đóng hộp
            </span>
          </p>
        </section>

        {/* Phải: tổng tiền, thao tác */}
        <aside className="bg-card flex min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border p-3" aria-label="Tổng tiền">
          {can(permissions.customers.view) && (
            <button
              type="button"
              disabled={!hasShift}
              onClick={() => setDialog('customer')}
              className="hover:bg-muted focus-visible:ring-ring/50 flex min-h-11 items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-sm transition-colors focus-visible:ring-3 focus-visible:outline-none disabled:opacity-50"
            >
              <UserRound className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                {tab.customer ? (
                  <>
                    <strong>{tab.customer.name}</strong> · {formatPhone(tab.customer.phone)}
                  </>
                ) : (
                  <span className="text-muted-foreground">Khách lẻ · gắn khách thân thiết</span>
                )}
              </span>
              <Kbd className="text-muted-foreground">F4</Kbd>
            </button>
          )}
          <dl className="grid gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tổng số lượng</dt>
              <dd className="font-medium tabular-nums">{formatNumber(totalQty, 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tổng tiền hàng</dt>
              <dd className="font-medium tabular-nums">{formatVnd(priced.subtotal)}</dd>
            </div>
            {priced.lineDiscountTotal > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Giảm giá dòng</dt>
                <dd className="text-destructive font-medium tabular-nums">−{formatVnd(priced.lineDiscountTotal)}</dd>
              </div>
            )}
            {tab.orderDiscount && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground flex items-center gap-1">
                  Giảm giá hóa đơn
                  {tab.orderDiscount.type === 'PhanTram' && ` (${formatNumber(tab.orderDiscount.value, 1)}%)`}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Gỡ giảm giá hóa đơn"
                    onClick={() => {
                      held.updateActive((t) => ({ ...t, orderDiscount: undefined }))
                      refocus()
                    }}
                  >
                    <X />
                  </Button>
                </dt>
                <dd className="text-destructive font-medium tabular-nums">−{formatVnd(priced.orderDiscountAmount)}</dd>
              </div>
            )}
            {tab.approval && (
              <div className="text-success flex items-center gap-1.5 text-xs font-medium">
                <ShieldCheck className="size-3.5" aria-hidden="true" /> {tab.approval.approvedByName} đã xác nhận
              </div>
            )}
          </dl>
          <div className="bg-primary/8 border-primary/20 mt-auto rounded-xl border px-3 py-3">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Tổng thanh toán</p>
            <p
              className="text-primary text-right text-4xl leading-tight font-bold tabular-nums xl:text-5xl"
              aria-live="polite"
              data-testid="pos-total"
            >
              {formatVnd(priced.total)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-12 justify-between"
              disabled={!hasShift || !tab.lines.length || !can(permissions.orders.discount)}
              onClick={() => setDialog('discount')}
            >
              <span className="flex items-center gap-1.5">
                <Percent aria-hidden="true" /> Giảm giá
              </span>
              <Kbd>F8</Kbd>
            </Button>
            <Button variant="outline" className="h-12 justify-between" disabled={!hasShift} onClick={() => setDialog('price')}>
              <span className="flex items-center gap-1.5">
                <Tag aria-hidden="true" /> Kiểm giá
              </span>
              <Kbd>F3</Kbd>
            </Button>
          </div>
          <Button
            variant="cta"
            className="h-16 justify-between px-5 text-xl font-bold"
            disabled={!hasShift || !tab.lines.length || quote.isPending || stockBlocked}
            onClick={() => void startCheckout()}
          >
            Thanh toán
            <Kbd className="text-sm">F9</Kbd>
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive h-10"
            disabled={!hasShift || !tab.lines.length}
            onClick={() => setDialog('clear')}
          >
            <Trash2 aria-hidden="true" /> Xóa hóa đơn
          </Button>
        </aside>
      </div>

      <Dialog open={dialog === 'openShift'} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mở ca</DialogTitle>
            <DialogDescription>Đếm tiền lẻ trong két rồi nhập tiền đầu ca.</DialogDescription>
          </DialogHeader>
          {dialog === 'openShift' && (
            <OpenShiftForm
              defaultOpeningCash={store?.defaultOpeningCash ?? 500000}
              onOpened={() => setDialog(null)}
              onCancel={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <DiscountDialog
        open={dialog === 'discount'}
        onOpenChange={closeDialog}
        line={
          selected?.priced
            ? {
                name: `${selected.priced.productName} – ${selected.priced.unitName}`,
                amount: selected.priced.amount,
                discount: selected.line.discount,
              }
            : undefined
        }
        orderBase={priced.subtotal - priced.lineDiscountTotal}
        orderDiscount={tab.orderDiscount}
        pending={quote.isPending}
        onApply={(scope, d) => applyDiscount(scope, d)}
        onRemove={(scope) => applyDiscount(scope, undefined)}
      />

      <ManagerApprovalDialog
        open={!!approvalAsk}
        onOpenChange={(open) => {
          if (!open) {
            approvalResolve.current(null)
            approvalResolve.current = () => undefined
            setApprovalAsk(null)
          }
        }}
        action="GiamGia"
        reasons={approvalAsk?.reasons.map((r) => r.text) ?? []}
        onApproved={(a) => {
          approvalResolve.current({ token: a.token, by: a.approvedByName })
          approvalResolve.current = () => undefined
          setApprovalAsk(null)
        }}
      />

      <PriceCheckDialog open={dialog === 'price'} onOpenChange={closeDialog} catalog={catalog} index={index} />

      <CustomerDialog
        open={dialog === 'customer'}
        onOpenChange={closeDialog}
        current={tab.customer}
        canCreate={can(permissions.customers.create)}
        onSelect={(c) => {
          held.updateActive((t) => ({ ...t, customer: c }))
          setDialog(null)
        }}
      />

      <SampleBarcodesDialog
        open={dialog === 'sample'}
        onOpenChange={closeDialog}
        catalog={catalog}
        index={index}
        onScan={(code) => handleCode(code)}
      />

      <CheckoutDialog
        open={dialog === 'checkout' && !!checkoutState}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null)
            setCheckoutState(null)
          }
        }}
        amount={checkoutState?.amount ?? 0}
        nextCode={checkoutState?.nextCode}
        store={store}
        pending={checkout.isPending}
        error={checkoutState?.error}
        onSubmit={submitCheckout}
      />

      <ConfirmDialog
        open={dialog === 'clear'}
        onOpenChange={closeDialog}
        title={`Xóa ${tab.name}?`}
        description={`Bỏ ${tab.lines.length} dòng hàng của hóa đơn đang bán. Không hoàn tác được.`}
        confirmText="Xóa hóa đơn"
        variant="destructive"
        onConfirm={() => {
          held.removeTab(tab.id)
          setSelectedKey(undefined)
          setDialog(null)
        }}
      />
    </PosShell>
  )
}
