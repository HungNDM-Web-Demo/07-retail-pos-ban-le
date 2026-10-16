'use client'
import { formatSignedVnd } from '@/features/pos/lib/money'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Printer, Undo2 } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { routePath, routeTo } from '@/config/route-path'
import { refundMethodLabels, returnConditionLabels, returnReasonLabels } from '@/config/retail-pos-labels'
import { presetRange, RangeSelect, type RangePreset } from '@/features/pos/components/ListFilters'
import { PrintPreviewHost } from '@/features/pos/components/PrintPreviewHost'
import { printUrl } from '@/features/pos/lib/print'
import { useCurrentShift } from '@/features/shifts/hooks/use-shifts'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatDateTime, formatVnd } from '@/lib/format'
import type { ReturnListItem } from '@/types/retail-pos'
import { useReturn, useReturns } from '../hooks/use-returns'

/** Đổi trả `/returns` (SCR-05): danh sách phiếu, nút "Tạo phiếu đổi trả" (khóa khi chưa mở ca, TC-06) */
export function ReturnsPage() {
  const { can } = usePermissions()
  const table = useTableQuery({ pageSize: 20 })
  const [range, setRange] = useState<RangePreset>('30d')
  const query = useMemo(() => ({ ...table.query, ...presetRange(range) }), [table.query, range])
  const { data, isLoading, isFetching, error, refetch } = useReturns(query)
  const shift = useCurrentShift(can(permissions.shifts.operate))
  const [openId, setOpenId] = useState<string | null>(null)
  const canCreate = can(permissions.returns.create)
  const hasShift = !!shift.data

  const columns = useMemo<ColumnDef<ReturnListItem>[]>(
    () => [
      { accessorKey: 'code', header: 'Mã phiếu', cell: ({ row }) => <span className="font-medium tabular-nums">{row.original.code}</span> },
      { accessorKey: 'createdAt', header: 'Thời gian', enableSorting: true, cell: ({ row }) => formatDateTime(row.original.createdAt) },
      { accessorKey: 'orderCode', header: 'Hóa đơn gốc' },
      { accessorKey: 'cashierName', header: 'Thu ngân' },
      {
        accessorKey: 'refundTotal',
        header: 'Tiền hoàn',
        enableSorting: true,
        cell: ({ row }) => <span className="font-semibold tabular-nums">{formatVnd(row.original.refundTotal)}</span>,
      },
      {
        id: 'payout',
        header: 'Trả khách',
        cell: ({ row }) =>
          row.original.payoutAmount > 0
            ? `${formatVnd(row.original.payoutAmount)} · ${refundMethodLabels[row.original.refundMethod]}`
            : '—',
      },
      {
        id: 'tags',
        header: 'Ghi chú',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.exchangeOrderCode && <StatusBadge tone="info">Đổi hàng {row.original.exchangeOrderCode}</StatusBadge>}
            {row.original.hasDefective && <StatusBadge tone="warning">Hàng lỗi</StatusBadge>}
            {row.original.approvedByName && <StatusBadge tone="neutral">Duyệt: {row.original.approvedByName}</StatusBadge>}
          </div>
        ),
      },
    ],
    []
  )

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Đổi trả"
        icon={Undo2}
        description="Phiếu đổi trả, hàng lỗi, hóa đơn đổi hàng"
        actions={
          canCreate && (
            <div className="flex flex-col items-end gap-1">
              {hasShift ? (
                <Button asChild variant="cta">
                  <Link href={routePath.returnNew}>
                    <Plus aria-hidden="true" /> Tạo phiếu đổi trả
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="cta" disabled>
                    <Plus aria-hidden="true" /> Tạo phiếu đổi trả
                  </Button>
                  <span className="text-muted-foreground text-xs">Mở ca trước khi đổi trả</span>
                </>
              )}
            </div>
          )
        }
      />
      <DataTable
        columns={columns}
        data={data?.items}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        getRowId={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
        minWidth={900}
        sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
        pagination={data && { ...data, onPageChange: table.setPage, onPageSizeChange: table.setPageSize }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput onSearch={table.setSearch} placeholder="Mã phiếu, mã hóa đơn gốc…" className="w-64" />
            <RangeSelect
              value={range}
              onChange={(v) => {
                setRange(v)
                table.setPage(1)
              }}
            />
          </div>
        }
        emptyState={<EmptyState title="Chưa có phiếu đổi trả" description="Đổi khoảng ngày để xem thêm." />}
      />
      <ReturnDetailSheet returnId={openId} onClose={() => setOpenId(null)} canReprint={can(permissions.orders.reprint)} />
      <PrintPreviewHost />
    </div>
  )
}

function ReturnDetailSheet({ returnId, onClose, canReprint }: { returnId: string | null; onClose: () => void; canReprint: boolean }) {
  const { data: r, isLoading, error, refetch } = useReturn(returnId)
  return (
    <Sheet open={!!returnId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>Phiếu đổi trả {r?.code}</SheetTitle>
          <SheetDescription>
            {r ? `${formatDateTime(r.createdAt)} · ${r.cashierName} · hóa đơn gốc ${r.orderCode}` : 'Đang tải…'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4 text-sm">
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : r ? (
            <div className="grid gap-3">
              <ul className="grid gap-2">
                {r.lines.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3 border-b pb-2">
                    <div>
                      <p className="font-medium">{l.productName}</p>
                      <p className="text-muted-foreground text-xs">
                        Trả {l.quantity} {l.unitName} · {returnConditionLabels[l.condition]} · {returnReasonLabels[l.reason]}
                        {l.note ? ` · ${l.note}` : ''}
                      </p>
                    </div>
                    <span className="tabular-nums">{formatVnd(l.refundAmount)}</span>
                  </li>
                ))}
              </ul>
              <dl className="grid gap-1">
                <div className="flex justify-between font-semibold">
                  <dt>Tiền hoàn</dt>
                  <dd className="tabular-nums">{formatVnd(r.refundTotal)}</dd>
                </div>
                {r.exchangeOrder && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Hóa đơn đổi {r.exchangeOrder.code}</dt>
                      <dd className="tabular-nums">{formatVnd(r.exchangeOrder.total)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Bù trừ đổi hàng</dt>
                      <dd className="tabular-nums">{formatVnd(r.offsetAmount)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Chênh lệch</dt>
                      <dd className="tabular-nums">{formatSignedVnd(r.difference)}</dd>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Trả khách ({refundMethodLabels[r.refundMethod].toLowerCase()})</dt>
                  <dd className="tabular-nums">{formatVnd(r.payoutAmount)}</dd>
                </div>
              </dl>
              {r.approvedByName && <p>Chủ cửa hàng xác nhận: {r.approvedByName}</p>}
              {r.note && <p className="text-muted-foreground">Ghi chú: {r.note}</p>}
            </div>
          ) : null}
        </div>
        {r && canReprint && (
          <SheetFooter className="flex-row justify-end gap-2 border-t">
            {r.exchangeOrder && (
              <Button variant="outline" onClick={() => printUrl(`${routeTo.orderReceipt(r.exchangeOrder!.id)}?reprint=1`)}>
                <Printer aria-hidden="true" /> In hóa đơn đổi
              </Button>
            )}
            <Button onClick={() => printUrl(`${routeTo.returnReceipt(r.id)}?reprint=1`)}>
              <Printer aria-hidden="true" /> In lại phiếu
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
