'use client'

import { useState } from 'react'
import Link from 'next/link'
import { History } from 'lucide-react'
import { DataTablePagination } from '@/components/shared/DataTablePagination'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { movementTypeLabels, stockStatusLabels, stockStatusVariants } from '@/config/retail-pos-labels'
import { routePath, routeTo } from '@/config/route-path'
import { formatSignedQty } from '@/features/products/lib/product-format'
import { usePermissions } from '@/hooks/use-permissions'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MovementType, StockItem, StockMovementDto } from '@/types/retail-pos'
import { useStockMovements } from '../hooks/use-stock'

const TONES: Record<MovementType, 'neutral' | 'info' | 'success' | 'warning' | 'primary'> = {
  TonDau: 'neutral',
  BanHang: 'info',
  TraHang: 'warning',
  NhapHang: 'success',
  DieuChinh: 'primary',
}

/** Link chứng từ của dòng biến động: hóa đơn, phiếu đổi trả mở danh sách đã tìm sẵn mã; phiếu nhập mở trang phiếu */
export function DocumentLink({
  m,
  onAdjustment,
}: {
  m: Pick<StockMovementDto, 'type' | 'documentId' | 'documentCode'>
  onAdjustment?: (id: string) => void
}) {
  const cls = 'text-primary font-mono text-sm underline-offset-4 hover:underline'
  if (m.type === 'TonDau' || !m.documentId) return <span className="text-muted-foreground text-sm">{m.documentCode}</span>
  if (m.type === 'NhapHang')
    return (
      <Link className={cls} href={routeTo.goodsReceipt(m.documentId)}>
        {m.documentCode}
      </Link>
    )
  if (m.type === 'DieuChinh')
    return onAdjustment ? (
      <button type="button" className={cls} onClick={() => onAdjustment(m.documentId!)}>
        {m.documentCode}
      </button>
    ) : (
      <span className="font-mono text-sm">{m.documentCode}</span>
    )
  const base = m.type === 'TraHang' ? routePath.returns : routePath.orders
  return (
    <Link className={cls} href={`${base}?search=${encodeURIComponent(m.documentCode)}`}>
      {m.documentCode}
    </Link>
  )
}

/** Lịch sử biến động tồn của một mặt hàng (FR-32): mới nhất trước, tồn sau, giá vốn sau */
export function MovementSheet({
  item,
  onOpenChange,
  onAdjustment,
}: {
  item: StockItem | null
  onOpenChange: (open: boolean) => void
  onAdjustment: (id: string) => void
}) {
  const { can } = usePermissions()
  const canViewCost = can(permissions.products.viewCost)
  const [page, setPage] = useState({ page: 1, pageSize: 20 })
  const [lastId, setLastId] = useState<string | null>(null)
  if ((item?.productId ?? null) !== lastId) {
    setLastId(item?.productId ?? null)
    setPage({ page: 1, pageSize: 20 })
  }
  const movements = useStockMovements(item?.productId ?? null, page)
  const data = movements.data

  return (
    <Sheet open={!!item} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <History className="size-5" aria-hidden="true" />
            Lịch sử biến động tồn
          </SheetTitle>
          <SheetDescription>
            {item ? (
              <>
                <span className="text-foreground font-medium">{item.name}</span> <span className="font-mono">{item.code}</span>
              </>
            ) : null}
          </SheetDescription>
          {item && (
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground text-xs">Tồn</dt>
                <dd className="font-semibold tabular-nums">
                  {formatNumber(item.stock, 0)} {item.baseUnit.toLowerCase()}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Đọc quy đổi</dt>
                <dd className="font-medium">{item.stockText}</dd>
              </div>
              {canViewCost && (
                <div>
                  <dt className="text-muted-foreground text-xs">Giá vốn bình quân</dt>
                  <dd className="font-medium tabular-nums">{formatVnd(item.avgCost)}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground text-xs">Trạng thái</dt>
                <dd>
                  <StatusBadge tone={stockStatusVariants[item.status]}>{stockStatusLabels[item.status]}</StatusBadge>
                </dd>
              </div>
            </dl>
          )}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {movements.error ? (
            <ErrorState error={movements.error} onRetry={() => void movements.refetch()} />
          ) : movements.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : !data || data.totalCount === 0 ? (
            <EmptyState icon={History} title="Chưa có biến động" compact />
          ) : (
            <table className={cn('w-full text-sm transition-opacity', movements.isFetching && 'opacity-60')}>
              <thead className="bg-muted/50 text-muted-foreground sticky top-0 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Thời gian</th>
                  <th className="px-2 py-2 text-left font-semibold">Chứng từ</th>
                  <th className="px-2 py-2 text-right font-semibold">SL</th>
                  <th className="px-2 py-2 text-right font-semibold">Tồn sau</th>
                  {canViewCost && <th className="px-4 py-2 text-right font-semibold">Giá vốn sau</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 tabular-nums whitespace-nowrap">{formatDateTime(m.at)}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge tone={TONES[m.type]} dot={false}>
                          {movementTypeLabels[m.type]}
                        </StatusBadge>
                        <DocumentLink m={m} onAdjustment={onAdjustment} />
                      </div>
                    </td>
                    <td className={cn('px-2 py-2 text-right font-medium tabular-nums', m.quantity < 0 ? 'text-destructive' : 'text-success')}>
                      {m.type === 'TonDau' ? formatNumber(m.quantity, 0) : formatSignedQty(m.quantity)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatSignedQty(m.stockAfter, false)}</td>
                    {canViewCost && <td className="px-4 py-2 text-right tabular-nums">{formatVnd(m.costAfter)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {data && data.totalCount > 0 && (
          <div className="border-t">
            <DataTablePagination
              page={data.page}
              pageSize={data.pageSize}
              totalCount={data.totalCount}
              totalPages={data.totalPages}
              onPageChange={(p) => setPage((s) => ({ ...s, page: p }))}
              onPageSizeChange={(n) => setPage({ page: 1, pageSize: n })}
              pageSizeOptions={[20, 50, 100]}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
