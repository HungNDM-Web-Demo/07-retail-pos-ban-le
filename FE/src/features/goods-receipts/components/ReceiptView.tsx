'use client'

import { Lock } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { permissions } from '@/config/permissions'
import { goodsReceiptStatusLabels, goodsReceiptStatusVariants } from '@/config/retail-pos-labels'
import { usePermissions } from '@/hooks/use-permissions'
import { formatDate, formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { GoodsReceiptDto } from '@/types/retail-pos'

/** Phiếu đã nhập kho: chỉ xem, giá vốn trước/sau từng dòng (TC-41, BR-24); sai thì dùng phiếu điều chỉnh */
export function ReceiptView({ receipt: r }: { receipt: GoodsReceiptDto }) {
  const { can } = usePermissions()
  const canViewCost = can(permissions.products.viewCost)

  return (
    <div className="space-y-4">
      <div className="bg-card grid gap-4 rounded-xl border p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-5">
        <Info label="Nhà cung cấp" value={r.supplierName} />
        <Info label="Ngày nhập" value={formatDate(r.receivedDate)} />
        <Info label="Người lập" value={r.createdByName} />
        <Info label="Xác nhận lúc" value={formatDateTime(r.confirmedAt)} />
        <div>
          <p className="text-muted-foreground text-xs">Trạng thái</p>
          <StatusBadge tone={goodsReceiptStatusVariants[r.status]} className="mt-1">
            {goodsReceiptStatusLabels[r.status]}
          </StatusBadge>
        </div>
        {r.note && <Info label="Ghi chú" value={r.note} className="sm:col-span-2 lg:col-span-5" />}
      </div>
      <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <Lock className="size-4" aria-hidden="true" />
        Phiếu đã nhập kho không sửa, không xóa. Nhập sai thì lập phiếu điều chỉnh ở Tồn kho.
      </p>
      <div className="bg-card overflow-x-auto rounded-xl border shadow-xs">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
            <tr>
              <th className="w-10 px-3 py-3 text-left font-semibold">#</th>
              <th className="px-3 py-3 text-left font-semibold">Mặt hàng</th>
              <th className="px-3 py-3 text-left font-semibold">Đơn vị</th>
              <th className="px-3 py-3 text-right font-semibold">Số lượng</th>
              <th className="px-3 py-3 text-right font-semibold">Đơn giá</th>
              <th className="px-3 py-3 text-right font-semibold">Thành tiền</th>
              <th className="px-3 py-3 text-left font-semibold">Hạn sử dụng</th>
              {canViewCost && <th className="px-3 py-3 text-right font-semibold">Giá vốn trước → sau</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {r.lines.map((l) => (
              <tr key={l.id}>
                <td className="text-muted-foreground px-3 py-2.5 tabular-nums">{l.lineNo}</td>
                <td className="px-3 py-2.5">
                  <p className="font-medium">{l.productName}</p>
                  <p className="text-muted-foreground font-mono text-xs">{l.productCode}</p>
                </td>
                <td className="px-3 py-2.5">{l.unitName}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {formatNumber(l.quantity, 0)}
                  {l.factor > 1 && <span className="text-muted-foreground block text-xs">= {formatNumber(l.baseQty, 0)}</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatVnd(l.unitPrice)}</td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatVnd(l.amount)}</td>
                <td className="px-3 py-2.5 tabular-nums">{l.trackExpiry ? formatDate(l.expiryDate) : '—'}</td>
                {canViewCost && (
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatVnd(l.costBefore)} →{' '}
                    <span className={cn('font-semibold', l.costAfter !== l.costBefore && 'text-primary')}>{formatVnd(l.costAfter)}</span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t">
            <tr>
              <td colSpan={5} className="px-3 py-3 text-right font-medium">
                Tổng tiền phiếu
              </td>
              <td className="px-3 py-3 text-right text-base font-semibold tabular-nums">{formatVnd(r.totalAmount)}</td>
              <td colSpan={canViewCost ? 2 : 1} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function Info({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  )
}
