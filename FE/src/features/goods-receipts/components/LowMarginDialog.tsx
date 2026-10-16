'use client'

import { useState } from 'react'
import { Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { posRules } from '@/config/pos-rules'
import { marginPct } from '@/features/pos/lib/stock-math'
import { NumberInput } from '@/features/products/components/NumberInput'
import { useUpdateProductPrices } from '@/features/products/hooks/use-products'
import { MarginText } from '@/features/products/lib/product-format'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import type { LowMarginItem } from '@/types/retail-pos'

const validPrice = (v: number | undefined) => !!v && v > 0 && v % posRules.priceStep === 0

/**
 * Hộp "Biên lãi dưới 5%" sau xác nhận nhập kho (FR-35, UC-14 bước 6, TC-40): mỗi mặt hàng sửa giá các đơn vị
 * rồi lưu (`PATCH /api/products/{id}/prices`), hoặc bỏ qua.
 */
export function LowMarginDialog({ items, onClose }: { items: LowMarginItem[]; onClose: () => void }) {
  const update = useUpdateProductPrices()
  const [prices, setPrices] = useState<Record<string, number | undefined>>(() =>
    Object.fromEntries(items.flatMap((p) => p.units.map((u) => [u.unitId, u.price])))
  )
  const [saving, setSaving] = useState(false)

  const changed = items.filter((p) => p.units.some((u) => prices[u.unitId] !== u.price))
  const invalid = items.some((p) => p.units.some((u) => !validPrice(prices[u.unitId])))

  const save = async () => {
    setSaving(true)
    try {
      for (const p of changed) {
        await update.mutateAsync({ id: p.productId, input: { prices: p.units.map((u) => ({ unitId: u.unitId, price: prices[u.unitId]! })) } })
      }
      toast.success(`Đã cập nhật giá ${changed.length} mặt hàng`)
      onClose()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={items.length > 0} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="text-warning size-5" aria-hidden="true" />
            Biên lãi dưới 5%
          </DialogTitle>
          <DialogDescription>
            Sau lần nhập này, {items.length} mặt hàng có biên lãi dưới {posRules.lowMarginPct}% theo giá vốn bình quân mới. Sửa giá bán ngay hoặc bỏ qua.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(100dvh-14rem)] divide-y overflow-y-auto px-6">
          {items.map((p) => {
            const base = p.units.find((u) => u.factor === 1) ?? p.units[0]
            const newMargin = marginPct(prices[base.unitId] ?? 0, p.avgCost)
            return (
              <section key={p.productId} className="space-y-3 py-4" aria-label={p.name}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {p.name} <span className="text-muted-foreground font-mono text-xs">{p.code}</span>
                  </p>
                  <p className="text-sm">
                    Giá vốn mới <strong className="tabular-nums">{formatVnd(p.avgCost)}</strong>/{p.baseUnit.toLowerCase()} · Biên lãi{' '}
                    <MarginText value={p.marginPct} />
                    {newMargin !== null && newMargin !== p.marginPct && (
                      <>
                        {' '}
                        → <MarginText value={newMargin} />
                      </>
                    )}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {p.units.map((u) => {
                    const v = prices[u.unitId]
                    return (
                      <label key={u.unitId} className="grid gap-1.5 text-sm">
                        <span className="font-medium">
                          {u.name} <span className="text-muted-foreground font-normal">(đang {formatVnd(u.price)})</span>
                        </span>
                        <NumberInput
                          value={v}
                          onValueChange={(n) => setPrices((s) => ({ ...s, [u.unitId]: n }))}
                          suffix="₫"
                          aria-invalid={!validPrice(v) || undefined}
                        />
                        {!validPrice(v) && <span className="text-destructive text-xs">Giá phải là bội số của 500 ₫</span>}
                        {validPrice(v) && u.factor > 1 && (
                          <span className="text-muted-foreground text-xs">Vốn {formatVnd(p.avgCost * u.factor)}</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Bỏ qua
          </Button>
          <Button onClick={() => void save()} disabled={saving || invalid || changed.length === 0}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            Lưu giá mới
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
