'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarClock, Loader2, PackageX } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { permissions } from '@/config/permissions'
import { lotStatusLabels, lotStatusVariants } from '@/config/retail-pos-labels'
import { routeTo } from '@/config/route-path'
import { productService } from '@/features/products/services/product.service'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { formatDate, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { LotStatus, StockLotDto } from '@/types/retail-pos'
import { useStockLots } from '../hooks/use-stock'
import type { AdjustmentPreset } from './AdjustmentFormDialog'

const daysText = (d: number) => (d < 0 ? `Quá hạn ${-d} ngày` : d === 0 ? 'Hết hạn hôm nay' : `Còn ${d} ngày`)

/**
 * Tab Sắp hết hạn (FR-31, BR-27): lô còn hàng có hạn trong 30 ngày tới và lô đã hết hạn, số còn lại ước tính.
 * "Hủy lô" mở phiếu điều chỉnh điền sẵn: lý do Hết hạn, thực tế = tồn − còn lại của lô (quyết định 21, TC-38).
 */
export function LotsTab({ onDispose }: { onDispose: (preset: AdjustmentPreset) => void }) {
  const { can } = usePermissions()
  const canAdjust = can(permissions.stockAdjustments.create)
  const [status, setStatus] = useState<LotStatus | 'all'>('all')
  const lots = useStockLots(status === 'all' ? {} : { status })
  const [pending, setPending] = useState<string | null>(null)

  const dispose = async (lot: StockLotDto) => {
    setPending(lot.goodsReceiptLineId)
    try {
      const product = await productService.get(lot.productId)
      onDispose({
        reason: 'HetHan',
        note: `Hủy lô ${lot.goodsReceiptCode}, hạn ${formatDate(lot.expiryDate)}`,
        goodsReceiptLineId: lot.goodsReceiptLineId,
        product,
        actualQty: Math.max(product.stock - lot.remainingQty, 0),
      })
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setPending(null)
    }
  }

  const items = lots.data ?? []
  const expiring = items.filter((l) => l.status === 'SapHetHan').length
  const expired = items.filter((l) => l.status === 'DaHetHan').length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          value={status}
          onValueChange={(v) => v && setStatus(v as LotStatus | 'all')}
          aria-label="Lọc lô theo trạng thái"
        >
          <ToggleGroupItem value="all" className="px-3">
            Cần xử lý
          </ToggleGroupItem>
          <ToggleGroupItem value="SapHetHan" className="px-3">
            {lotStatusLabels.SapHetHan}
          </ToggleGroupItem>
          <ToggleGroupItem value="DaHetHan" className="px-3">
            {lotStatusLabels.DaHetHan}
          </ToggleGroupItem>
        </ToggleGroup>
        {status === 'all' && lots.data && (
          <p className="text-muted-foreground text-sm">
            {expiring} lô sắp hết hạn, {expired} lô đã hết hạn. Số còn lại ước tính theo nguyên tắc hàng nhập trước bán trước.
          </p>
        )}
      </div>

      <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
        {lots.error ? (
          <ErrorState error={lots.error} onRetry={() => void lots.refetch()} />
        ) : lots.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Không có lô cần xử lý" description="Lô còn hàng có hạn dưới 30 ngày hoặc đã hết hạn sẽ hiện ở đây." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Mặt hàng</th>
                  <th className="px-3 py-3 text-left font-semibold">Lô (phiếu nhập)</th>
                  <th className="px-3 py-3 text-left font-semibold">Hạn sử dụng</th>
                  <th className="px-3 py-3 text-right font-semibold">Đã nhập</th>
                  <th className="px-3 py-3 text-right font-semibold">Còn lại ước tính</th>
                  <th className="px-3 py-3 text-left font-semibold">Trạng thái</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((lot) => (
                  <tr key={lot.goodsReceiptLineId} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{lot.productName}</p>
                      <p className="text-muted-foreground font-mono text-xs">{lot.productCode}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={routeTo.goodsReceipt(lot.goodsReceiptId)} className="text-primary font-mono underline-offset-4 hover:underline">
                        {lot.goodsReceiptCode}
                      </Link>
                      <p className="text-muted-foreground text-xs">Nhập {formatDate(lot.receivedAt)}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="tabular-nums">{formatDate(lot.expiryDate)}</p>
                      <p className={cn('text-xs font-medium', lot.daysLeft < 0 ? 'text-destructive' : 'text-warning')}>{daysText(lot.daysLeft)}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(lot.receivedQty, 0)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                      {formatNumber(lot.remainingQty, 0)} <span className="text-muted-foreground text-xs font-normal">{lot.baseUnit.toLowerCase()}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tone={lotStatusVariants[lot.status]}>{lotStatusLabels[lot.status]}</StatusBadge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {canAdjust && lot.remainingQty > 0 && (
                        <Button
                          variant={lot.status === 'DaHetHan' ? 'destructive' : 'outline'}
                          size="sm"
                          onClick={() => void dispose(lot)}
                          disabled={pending === lot.goodsReceiptLineId}
                        >
                          {pending === lot.goodsReceiptLineId ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PackageX aria-hidden="true" />}
                          Hủy lô
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
