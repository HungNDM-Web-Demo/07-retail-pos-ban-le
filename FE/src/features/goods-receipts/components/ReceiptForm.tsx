'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCheck, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { permissions } from '@/config/permissions'
import { routePath, routeTo } from '@/config/route-path'
import { marginPct, nextAvgCost } from '@/features/pos/lib/stock-math'
import { addDaysKey, vnTodayKey } from '@/features/pos/lib/vn-time'
import { NumberInput } from '@/features/products/components/NumberInput'
import { ProductPicker, type ProductPickerHandle } from '@/features/products/components/ProductPicker'
import { useProductsByIds } from '@/features/products/hooks/use-products'
import { MarginText } from '@/features/products/lib/product-format'
import { usePermissions } from '@/hooks/use-permissions'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { applyFormErrors } from '@/features/pos/lib/problem'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ConfirmGoodsReceiptResult, GoodsReceiptDto, ProductDto, SaveGoodsReceiptRequest } from '@/types/retail-pos'
import { useConfirmGoodsReceipt, useDeleteGoodsReceipt, useSaveGoodsReceipt, useSupplierOptions } from '../hooks/use-goods-receipts'
import { goodsReceiptSchema, type GoodsReceiptFormValues } from '../schemas/goods-receipt.schema'
import { SupplierFormDialog } from './SupplierFormDialog'

const ADD_SUPPLIER = '__add'
/** Ô lỗi form có hiển thị; lỗi khác (vd `lines.0.unitId`) hiện toast */
const isReceiptField = (key: string) =>
  /^(supplierId|receivedDate|note|lines)$/.test(key) || /^lines\.\d+\.(quantity|unitPrice|expiryDate)$/.test(key)

function toValues(r: GoodsReceiptDto | null): GoodsReceiptFormValues {
  if (!r) return { supplierId: '', receivedDate: vnTodayKey(), note: '', lines: [] }
  return {
    supplierId: r.supplierId,
    receivedDate: r.receivedDate,
    note: r.note ?? '',
    lines: r.lines.map((l) => ({
      productId: l.productId,
      unitId: l.unitId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      expiryDate: l.expiryDate ?? '',
    })),
  }
}

/**
 * Lập, sửa phiếu nhập nháp (SCR-12, UC-14, FR-34): chọn hoặc thêm nhanh NCC, quét mã (lookup) hoặc tìm tên, dòng gồm
 * đơn vị, số lượng, đơn giá nhập (gợi ý giá vốn × hệ số), HSD khi hàng có quản lý hạn. "Xác nhận nhập kho" lưu rồi
 * gọi confirm; lỗi HSD gắn đúng ô (TC-41). Xem trước giá vốn bình quân sau nhập (BR-23) khi có quyền xem giá vốn.
 */
export function ReceiptForm({
  receipt,
  onConfirmed,
}: {
  receipt: GoodsReceiptDto | null
  onConfirmed: (result: ConfirmGoodsReceiptResult) => void
}) {
  const router = useRouter()
  const { can } = usePermissions()
  const canViewCost = can(permissions.products.viewCost)
  const canConfirm = can(permissions.goodsReceipts.confirm)
  const canSave = can(receipt ? permissions.goodsReceipts.update : permissions.goodsReceipts.create)
  const suppliers = useSupplierOptions()
  const save = useSaveGoodsReceipt()
  const confirm = useConfirmGoodsReceipt()
  const remove = useDeleteGoodsReceipt()
  const pickerRef = useRef<ProductPickerHandle>(null)
  const [currentId, setCurrentId] = useState<string | undefined>(receipt?.id)
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [products, setProducts] = useState<Map<string, ProductDto>>(new Map())

  const form = useForm<GoodsReceiptFormValues>({ resolver: zodResolver(goodsReceiptSchema), defaultValues: toValues(receipt) })
  const lines = useFieldArray({ control: form.control, name: 'lines', keyName: 'key' })
  const [values, supplierId, receivedDate] = useWatch({ control: form.control, name: ['lines', 'supplierId', 'receivedDate'] })
  const { errors } = form.formState

  // Nạp thông tin hàng của phiếu nháp đã có (đơn vị, tồn, giá vốn)
  const lineIds = useMemo(() => [...new Set(receipt?.lines.map((l) => l.productId) ?? [])], [receipt])
  const preload = useProductsByIds(lineIds)
  const [loaded, setLoaded] = useState(preload.data)
  if (preload.data !== loaded) {
    setLoaded(preload.data)
    if (preload.data) setProducts((m) => new Map([...m, ...preload.data!.map((p) => [p.id, p] as const)]))
  }

  const addProduct = (p: ProductDto, unitId?: string) => {
    setProducts((m) => new Map(m).set(p.id, p))
    const unit = p.units.find((u) => u.id === unitId) ?? p.units[0]
    const idx = form.getValues('lines').findIndex((l) => l.productId === p.id && l.unitId === unit.id)
    if (idx >= 0) {
      form.setValue(`lines.${idx}.quantity`, (form.getValues(`lines.${idx}.quantity`) || 0) + 1, { shouldDirty: true })
      toast.info(`${p.name} – ${unit.name}: cộng thêm 1`)
      return
    }
    lines.append({ productId: p.id, unitId: unit.id, quantity: 1, unitPrice: Math.round((p.avgCost ?? 0) * unit.factor), expiryDate: '' })
  }

  const changeUnit = (i: number, unitId: string) => {
    const p = products.get(form.getValues(`lines.${i}.productId`))
    const unit = p?.units.find((u) => u.id === unitId)
    form.setValue(`lines.${i}.unitId`, unitId, { shouldDirty: true })
    if (p && unit) form.setValue(`lines.${i}.unitPrice`, Math.round((p.avgCost ?? 0) * unit.factor), { shouldDirty: true })
  }

  // Xem trước giá vốn sau nhập theo thứ tự dòng (BR-23)
  const preview = useMemo(() => {
    const state = new Map<string, { stock: number; cost: number }>()
    return (values ?? []).map((l) => {
      const p = products.get(l.productId)
      const unit = p?.units.find((u) => u.id === l.unitId)
      if (!p || !unit || p.avgCost === undefined || p.avgCost === null) return null
      const cur = state.get(p.id) ?? { stock: p.stock, cost: p.avgCost }
      const q = Number.isFinite(l.quantity) && l.quantity > 0 ? l.quantity : 0
      const price = Number.isFinite(l.unitPrice) ? l.unitPrice : 0
      const qIn = q * unit.factor
      const cost = qIn > 0 ? nextAvgCost(cur.stock, cur.cost, qIn, price / unit.factor) : cur.cost
      state.set(p.id, { stock: cur.stock + qIn, cost })
      return { before: cur.cost, after: cost, margin: marginPct(p.price, cost), stockAfter: cur.stock + qIn, baseUnit: p.baseUnit }
    })
  }, [values, products])

  const total = (values ?? []).reduce((s, l) => s + (Number.isFinite(l.quantity) && Number.isFinite(l.unitPrice) ? l.quantity * l.unitPrice : 0), 0)

  const toRequest = (v: GoodsReceiptFormValues): SaveGoodsReceiptRequest => ({
    supplierId: v.supplierId,
    receivedDate: v.receivedDate,
    note: v.note.trim() || undefined,
    lines: v.lines.map((l) => ({
      productId: l.productId,
      unitId: l.unitId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      expiryDate: l.expiryDate || undefined,
    })),
  })

  const persist = async (v: GoodsReceiptFormValues) => {
    const saved = await save.mutateAsync({ id: currentId, input: toRequest(v) })
    if (!currentId) {
      setCurrentId(saved.id)
      // Đổi URL sang phiếu vừa tạo mà không dựng lại form (lỗi xác nhận vẫn hiện tại ô)
      window.history.replaceState(null, '', routeTo.goodsReceipt(saved.id))
    }
    return saved
  }

  const onSaveDraft = form.handleSubmit(async (v) => {
    try {
      const saved = await persist(v)
      toast.success(`Đã lưu nháp ${saved.code}`)
    } catch (e) {
      applyFormErrors(form.setError, e, isReceiptField)
    }
  })

  const onConfirm = form.handleSubmit(async (v) => {
    try {
      const saved = await persist(v)
      const result = await confirm.mutateAsync(saved.id)
      toast.success(`Đã nhập kho ${result.receipt.code}`)
      onConfirmed(result)
    } catch (e) {
      applyFieldErrors(form.setError, e)
      toast.error(getErrorMessage(e))
    }
  })

  const busy = save.isPending || confirm.isPending
  const today = vnTodayKey()

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-card grid gap-4 rounded-xl border p-4 shadow-xs md:grid-cols-[minmax(0,1.4fr)_12rem_minmax(0,1.6fr)]">
        <FormField label="Nhà cung cấp" required error={errors.supplierId?.message}>
          <Select
            value={supplierId || undefined}
            onValueChange={(v) => {
              if (v === ADD_SUPPLIER) setSupplierOpen(true)
              else form.setValue('supplierId', v, { shouldDirty: true, shouldValidate: true })
            }}
          >
            <SelectTrigger className="w-full" aria-label="Nhà cung cấp">
              <SelectValue placeholder={suppliers.isLoading ? 'Đang tải…' : 'Chọn nhà cung cấp'} />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {(suppliers.data?.items ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
              {can(permissions.suppliers.create) && (
                <SelectItem value={ADD_SUPPLIER} className="text-primary font-medium">
                  <Plus aria-hidden="true" />
                  Thêm nhà cung cấp mới
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Ngày nhập" required error={errors.receivedDate?.message}>
          <Input type="date" max={today} {...form.register('receivedDate')} />
        </FormField>
        <FormField label="Ghi chú" error={errors.note?.message}>
          <Textarea rows={1} className="min-h-10" placeholder="vd: Giao bổ sung hàng cuối tuần" {...form.register('note')} />
        </FormField>
      </div>

      <div className="bg-card space-y-3 rounded-xl border p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Hàng nhập</h2>
          <p className="text-muted-foreground text-sm">Quét mã thùng, lốc để nhập đúng đơn vị. Đơn giá là giá của đơn vị đã chọn.</p>
        </div>
        <ProductPicker ref={pickerRef} onPick={addProduct} listenScan disabled={!canSave} />
        {errors.lines?.message && (
          <p className="text-destructive text-sm" role="alert">
            {errors.lines.message}
          </p>
        )}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="w-10 px-3 py-2 text-left font-semibold">#</th>
                <th className="px-3 py-2 text-left font-semibold">Mặt hàng</th>
                <th className="w-40 px-2 py-2 text-left font-semibold">Đơn vị</th>
                <th className="w-28 px-2 py-2 text-right font-semibold">Số lượng</th>
                <th className="w-40 px-2 py-2 text-right font-semibold">Đơn giá nhập</th>
                <th className="w-44 px-2 py-2 text-left font-semibold">Hạn sử dụng</th>
                <th className="w-36 px-3 py-2 text-right font-semibold">Thành tiền</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.fields.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-muted-foreground px-3 py-8 text-center">
                    Chưa có mặt hàng. Quét mã vạch hoặc gõ tên ở ô phía trên.
                  </td>
                </tr>
              ) : (
                lines.fields.map((f, i) => {
                  const l = values?.[i] ?? f
                  const p = products.get(l.productId)
                  const unit = p?.units.find((u) => u.id === l.unitId)
                  const e = errors.lines?.[i]
                  const pv = preview[i]
                  const amount = Number.isFinite(l.quantity) && Number.isFinite(l.unitPrice) ? l.quantity * l.unitPrice : 0
                  return (
                    <tr key={f.key} className="align-top">
                      <td className="text-muted-foreground px-3 py-2.5 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{p?.name ?? 'Đang tải…'}</p>
                        <p className="text-muted-foreground text-xs">
                          <span className="font-mono">{p?.code}</span>
                          {p && ` · Tồn ${p.stockText}`}
                        </p>
                        {canViewCost && pv && (
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            Giá vốn {formatVnd(pv.before)} →{' '}
                            <span className={cn('text-foreground font-medium', pv.after !== pv.before && 'text-primary')}>{formatVnd(pv.after)}</span>
                            /{pv.baseUnit.toLowerCase()} · biên <MarginText value={pv.margin} className="px-1 py-0" />
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Select value={l.unitId} onValueChange={(v) => changeUnit(i, v)} disabled={!p}>
                          <SelectTrigger className="w-full" aria-label={`Đơn vị dòng ${i + 1}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {p?.units.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name}
                                {u.factor > 1 ? ` (${u.factor} ${p.baseUnit.toLowerCase()})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <Controller
                          control={form.control}
                          name={`lines.${i}.quantity`}
                          render={({ field }) => (
                            <NumberInput ref={field.ref} value={field.value} onValueChange={(v) => field.onChange(v ?? NaN)} aria-label={`Số lượng dòng ${i + 1}`} aria-invalid={!!e?.quantity || undefined} />
                          )}
                        />
                        {e?.quantity && <p className="text-destructive mt-1 text-xs">{e.quantity.message}</p>}
                        {unit && unit.factor > 1 && Number.isFinite(l.quantity) && (
                          <p className="text-muted-foreground mt-1 text-right text-xs">= {formatNumber(l.quantity * unit.factor, 0)} {p?.baseUnit.toLowerCase()}</p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Controller
                          control={form.control}
                          name={`lines.${i}.unitPrice`}
                          render={({ field }) => (
                            <NumberInput ref={field.ref} value={field.value} onValueChange={(v) => field.onChange(v ?? NaN)} suffix="₫" aria-label={`Đơn giá dòng ${i + 1}`} aria-invalid={!!e?.unitPrice || undefined} />
                          )}
                        />
                        {e?.unitPrice ? (
                          <p className="text-destructive mt-1 text-xs">{e.unitPrice.message}</p>
                        ) : (
                          canViewCost &&
                          p &&
                          unit && <p className="text-muted-foreground mt-1 text-right text-xs">Gợi ý {formatVnd((p.avgCost ?? 0) * unit.factor)}</p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {p?.trackExpiry ? (
                          <>
                            <Input
                              type="date"
                              min={addDaysKey(receivedDate || today, 1)}
                              aria-label={`Hạn sử dụng dòng ${i + 1}`}
                              aria-invalid={!!e?.expiryDate || undefined}
                              {...form.register(`lines.${i}.expiryDate`)}
                            />
                            {e?.expiryDate ? (
                              <p className="text-destructive mt-1 text-xs" role="alert">
                                {e.expiryDate.message}
                              </p>
                            ) : (
                              <p className="text-muted-foreground mt-1 text-xs">Bắt buộc khi nhập kho</p>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground block pt-2.5 text-xs">Không quản lý hạn</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatVnd(amount)}</td>
                      <td className="px-1 py-2">
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => lines.remove(i)} aria-label={`Bỏ dòng ${i + 1}`}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Thanh thao tác dính đáy */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 -mx-4 border-t px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <p className="text-muted-foreground text-xs">{lines.fields.length} dòng · Tổng tiền phiếu</p>
            <p className="text-xl font-semibold tabular-nums">{formatVnd(total)}</p>
          </div>
          {currentId && can(permissions.goodsReceipts.delete) && (
            <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)} disabled={busy}>
              <Trash2 aria-hidden="true" />
              Xóa phiếu
            </Button>
          )}
          {canSave && (
            <Button type="button" variant="outline" onClick={() => void onSaveDraft()} disabled={busy}>
              {save.isPending && !confirm.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              Lưu nháp
            </Button>
          )}
          {canSave && canConfirm && (
            <Button type="button" onClick={() => void onConfirm()} disabled={busy}>
              {confirm.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCheck aria-hidden="true" />}
              Xác nhận nhập kho
            </Button>
          )}
        </div>
      </div>

      <SupplierFormDialog
        open={supplierOpen}
        onOpenChange={setSupplierOpen}
        supplier={null}
        onSaved={(s) => form.setValue('supplierId', s.id, { shouldDirty: true, shouldValidate: true })}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Xóa phiếu nhập nháp?"
        description="Phiếu nháp chưa ảnh hưởng tồn kho. Xóa rồi không khôi phục được."
        confirmText="Xóa phiếu"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(currentId!)
            toast.success('Đã xóa phiếu nháp')
            router.push(routePath.goodsReceipts)
          } catch (e) {
            toast.error(getErrorMessage(e))
            throw e
          }
        }}
      />
    </div>
  )
}
