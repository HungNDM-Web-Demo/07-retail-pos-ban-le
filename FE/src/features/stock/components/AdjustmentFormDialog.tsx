'use client'

import { useEffect } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { permissions } from '@/config/permissions'
import { adjustmentReasonLabels } from '@/config/retail-pos-labels'
import { NumberInput } from '@/features/products/components/NumberInput'
import { ProductPicker } from '@/features/products/components/ProductPicker'
import { formatSignedQty, formatSignedVnd } from '@/features/products/lib/product-format'
import { usePermissions } from '@/hooks/use-permissions'
import { applyFormErrors } from '@/features/pos/lib/problem'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AdjustmentReason, ProductDto, StockAdjustmentDto } from '@/types/retail-pos'
import { useCreateStockAdjustment } from '../hooks/use-stock'
import { stockAdjustmentSchema, type AdjustmentLineValues, type StockAdjustmentFormValues } from '../schemas/stock-adjustment.schema'

/** Điền sẵn khi bấm "Hủy lô" (UC-13 bước 1, quyết định 21) */
export type AdjustmentPreset = {
  reason: AdjustmentReason
  note?: string
  goodsReceiptLineId?: string
  product: ProductDto
  actualQty: number
}

/** Ô lỗi form có hiển thị; lỗi khác (vd `goodsReceiptLineId`, `lines.0.productId`) hiện toast */
const isAdjustmentField = (key: string) => /^(reason|note|lines)$/.test(key) || /^lines\.\d+\.actualQty$/.test(key)

const toLine = (p: ProductDto, actualQty?: number): AdjustmentLineValues => ({
  productId: p.id,
  code: p.code,
  name: p.name,
  baseUnit: p.baseUnit,
  systemQty: p.stock,
  avgCost: p.avgCost ?? null,
  actualQty: actualQty ?? p.stock,
})

/**
 * Lập phiếu điều chỉnh tồn (SCR-10, UC-13, FR-33): nhập số lượng thực tế theo đơn vị cơ bản, hệ thống tính chênh lệch
 * và giá trị theo giá vốn bình quân (BR-28). Lưu là áp dụng ngay, không sửa được.
 */
export function AdjustmentFormDialog({
  open,
  onOpenChange,
  preset,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset?: AdjustmentPreset | null
  onSaved?: (adj: StockAdjustmentDto) => void
}) {
  const { can } = usePermissions()
  const canViewCost = can(permissions.products.viewCost)
  const create = useCreateStockAdjustment()
  const form = useForm<StockAdjustmentFormValues>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: { reason: 'DemLai', note: '', lines: [] },
  })
  const lines = useFieldArray({ control: form.control, name: 'lines', keyName: 'key' })
  const [values, reason] = useWatch({ control: form.control, name: ['lines', 'reason'] })
  const { errors } = form.formState

  useEffect(() => {
    if (!open) return
    form.reset(
      preset
        ? {
            reason: preset.reason,
            note: preset.note ?? '',
            goodsReceiptLineId: preset.goodsReceiptLineId,
            lines: [toLine(preset.product, preset.actualQty)],
          }
        : { reason: 'DemLai', note: '', goodsReceiptLineId: undefined, lines: [] }
    )
  }, [open, preset, form])

  const addProduct = (p: ProductDto) => {
    const idx = form.getValues('lines').findIndex((l) => l.productId === p.id)
    if (idx >= 0) {
      toast.info(`${p.name} đã có trong phiếu`)
      form.setFocus(`lines.${idx}.actualQty`)
      return
    }
    lines.append(toLine(p))
  }

  const totalValue = (values ?? []).reduce(
    (s, l) => s + (Number.isFinite(l.actualQty) ? (l.actualQty - l.systemQty) * (l.avgCost ?? 0) : 0),
    0
  )

  const onSubmit = form.handleSubmit((v) =>
    create.mutate(
      {
        reason: v.reason,
        note: v.note.trim() || undefined,
        goodsReceiptLineId: v.goodsReceiptLineId,
        lines: v.lines.map((l) => ({ productId: l.productId, actualQty: l.actualQty })),
      },
      {
        onSuccess: (adj) => {
          toast.success(`Đã lưu phiếu ${adj.code}, tồn đã cập nhật`)
          onSaved?.(adj)
          onOpenChange(false)
        },
        onError: (e) => {
          applyFormErrors(form.setError, e, isAdjustmentField)
        },
      }
    )
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{preset?.goodsReceiptLineId ? 'Hủy lô hàng' : 'Lập phiếu điều chỉnh tồn'}</DialogTitle>
          <DialogDescription>
            Nhập số lượng thực tế theo đơn vị cơ bản. Lưu là áp dụng ngay, không sửa được; giá vốn không đổi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="max-h-[calc(100dvh-14rem)] space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
              <FormField label="Lý do" required error={errors.reason?.message}>
                <Controller
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(adjustmentReasonLabels) as AdjustmentReason[]).map((r) => (
                          <SelectItem key={r} value={r}>
                            {adjustmentReasonLabels[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField label="Ghi chú" required={reason === 'Khac'} error={errors.note?.message}>
                <Textarea rows={1} className="min-h-10" placeholder="vd: Kiểm kệ cuối ngày thiếu 2 gói" {...form.register('note')} />
              </FormField>
            </div>

            {!preset?.goodsReceiptLineId && <ProductPicker onPick={(p) => addProduct(p)} includeInactive />}

            {errors.lines?.message && (
              <p className="text-destructive text-sm" role="alert">
                {errors.lines.message}
              </p>
            )}
            {errors.lines?.root?.message && (
              <p className="text-destructive text-sm" role="alert">
                {errors.lines.root.message}
              </p>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Mặt hàng</th>
                    <th className="px-3 py-2 text-right font-semibold">Tồn hệ thống</th>
                    <th className="w-36 px-3 py-2 text-right font-semibold">Thực tế</th>
                    <th className="px-3 py-2 text-right font-semibold">Chênh lệch</th>
                    {canViewCost && <th className="px-3 py-2 text-right font-semibold">Giá trị</th>}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.fields.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-muted-foreground px-3 py-6 text-center">
                        Quét mã hoặc gõ tên để thêm mặt hàng cần điều chỉnh.
                      </td>
                    </tr>
                  ) : (
                    lines.fields.map((f, i) => {
                      const l = values?.[i] ?? f
                      const diff = Number.isFinite(l.actualQty) ? l.actualQty - l.systemQty : 0
                      return (
                        <tr key={f.key}>
                          <td className="px-3 py-2">
                            <p className="font-medium">{l.name}</p>
                            <p className="text-muted-foreground font-mono text-xs">{l.code}</p>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatNumber(l.systemQty, 0)} <span className="text-muted-foreground text-xs">{l.baseUnit.toLowerCase()}</span>
                          </td>
                          <td className="px-3 py-2">
                            <Controller
                              control={form.control}
                              name={`lines.${i}.actualQty`}
                              render={({ field }) => (
                                <NumberInput
                                  ref={field.ref}
                                  value={field.value}
                                  onValueChange={(v) => field.onChange(v ?? NaN)}
                                  aria-label={`Số lượng thực tế ${l.name}`}
                                  aria-invalid={!!errors.lines?.[i]?.actualQty || undefined}
                                />
                              )}
                            />
                            {errors.lines?.[i]?.actualQty && (
                              <p className="text-destructive mt-1 text-xs" role="alert">
                                {errors.lines[i]?.actualQty?.message}
                              </p>
                            )}
                          </td>
                          <td className={cn('px-3 py-2 text-right font-medium tabular-nums', diff < 0 ? 'text-destructive' : diff > 0 ? 'text-success' : 'text-muted-foreground')}>
                            {formatSignedQty(diff)}
                          </td>
                          {canViewCost && (
                            <td className={cn('px-3 py-2 text-right tabular-nums', diff < 0 && 'text-destructive')}>
                              {l.avgCost === null ? '—' : formatSignedVnd(diff * l.avgCost)}
                            </td>
                          )}
                          <td className="px-1 py-2">
                            {!preset?.goodsReceiptLineId && (
                              <Button type="button" variant="ghost" size="icon-sm" onClick={() => lines.remove(i)} aria-label={`Bỏ ${l.name}`}>
                                <Trash2 aria-hidden="true" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {canViewCost && lines.fields.length > 0 && (
                  <tfoot className="border-t">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right font-medium">
                        Tổng giá trị điều chỉnh
                      </td>
                      <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', totalValue < 0 && 'text-destructive')}>
                        {formatSignedVnd(totalValue)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Lưu và áp dụng
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
