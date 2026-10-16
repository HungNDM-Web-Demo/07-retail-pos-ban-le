'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ErrorState } from '@/components/shared/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { adjustmentReasonLabels } from '@/config/retail-pos-labels'
import { formatSignedQty, formatSignedVnd } from '@/features/products/lib/product-format'
import { usePermissions } from '@/hooks/use-permissions'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useStockAdjustment } from '../hooks/use-stock'

/** Xem phiếu điều chỉnh (không sửa được, BR-28) */
export function AdjustmentDetailDialog({ id, onOpenChange }: { id: string | null; onOpenChange: (open: boolean) => void }) {
  const { can } = usePermissions()
  const canViewCost = can(permissions.products.viewCost)
  const q = useStockAdjustment(id)
  const a = q.data

  return (
    <Dialog open={!!id} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Phiếu điều chỉnh {a?.code ?? ''}</DialogTitle>
          <DialogDescription>
            {a ? (
              <>
                {formatDateTime(a.createdAt)} · {a.createdByName} · Lý do <strong>{adjustmentReasonLabels[a.reason]}</strong>
                {a.note ? ` · ${a.note}` : ''}
              </>
            ) : (
              'Đang tải…'
            )}
          </DialogDescription>
        </DialogHeader>
        {q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !a ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Mặt hàng</th>
                  <th className="px-3 py-2 text-right font-semibold">Hệ thống</th>
                  <th className="px-3 py-2 text-right font-semibold">Thực tế</th>
                  <th className="px-3 py-2 text-right font-semibold">Chênh lệch</th>
                  {canViewCost && <th className="px-3 py-2 text-right font-semibold">Giá vốn</th>}
                  {canViewCost && <th className="px-3 py-2 text-right font-semibold">Giá trị</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {a.lines.map((l) => (
                  <tr key={l.productId}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{l.productName}</p>
                      <p className="text-muted-foreground font-mono text-xs">{l.productCode}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(l.systemQty, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(l.actualQty, 0)} <span className="text-muted-foreground text-xs">{l.baseUnit.toLowerCase()}</span>
                    </td>
                    <td className={cn('px-3 py-2 text-right font-medium tabular-nums', l.difference < 0 ? 'text-destructive' : 'text-success')}>
                      {formatSignedQty(l.difference)}
                    </td>
                    {canViewCost && <td className="px-3 py-2 text-right tabular-nums">{formatVnd(l.unitCost)}</td>}
                    {canViewCost && (
                      <td className={cn('px-3 py-2 text-right tabular-nums', l.value < 0 && 'text-destructive')}>{formatSignedVnd(l.value)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
              {canViewCost && (
                <tfoot className="border-t">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-right font-medium">
                      Tổng giá trị
                    </td>
                    <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', a.totalValue < 0 && 'text-destructive')}>
                      {formatSignedVnd(a.totalValue)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
