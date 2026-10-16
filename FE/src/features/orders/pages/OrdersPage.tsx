'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ReceiptText } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { permissions } from '@/config/permissions'
import {
  orderReturnStatusLabels,
  orderReturnStatusVariants,
  paymentMethodLabels,
} from '@/config/retail-pos-labels'
import { FilterSelect, presetRange, RangeSelect, type RangePreset } from '@/features/pos/components/ListFilters'
import { PrintPreviewHost } from '@/features/pos/components/PrintPreviewHost'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatDateTime, formatVnd } from '@/lib/format'
import type { OrderListItem, OrderReturnStatus, PaymentMethod } from '@/types/retail-pos'
import { OrderDetailSheet } from '../components/OrderDetailSheet'
import { useOrders } from '../hooks/use-orders'

type Filters = { paymentMethod: PaymentMethod; returnStatus: OrderReturnStatus }

/** Hóa đơn `/orders` (SCR-08, FR-21): thu ngân chỉ thấy hóa đơn trong ca của mình (07 §1) */
export function OrdersPage() {
  const { can } = usePermissions()
  const table = useTableQuery<Filters>({ pageSize: 20 })
  const [range, setRange] = useState<RangePreset>('7d')
  const query = useMemo(() => ({ ...table.query, ...presetRange(range) }), [table.query, range])
  const { data, isLoading, isFetching, error, refetch } = useOrders(query)
  const [openId, setOpenId] = useState<string | null>(null)
  const seeAll = can(permissions.shifts.view)

  const columns = useMemo<ColumnDef<OrderListItem>[]>(
    () => [
      { accessorKey: 'code', header: 'Mã hóa đơn', cell: ({ row }) => <span className="font-medium tabular-nums">{row.original.code}</span> },
      { accessorKey: 'paidAt', header: 'Thời gian', enableSorting: true, cell: ({ row }) => formatDateTime(row.original.paidAt) },
      { accessorKey: 'shiftCode', header: 'Ca' },
      ...(seeAll ? [{ accessorKey: 'cashierName', header: 'Thu ngân' } as ColumnDef<OrderListItem>] : []),
      { accessorKey: 'itemCount', header: 'SL', cell: ({ row }) => <span className="tabular-nums">{row.original.itemCount}</span> },
      {
        accessorKey: 'total',
        header: 'Tổng thanh toán',
        enableSorting: true,
        cell: ({ row }) => (
          <div className="text-right">
            <p className="font-semibold tabular-nums">{formatVnd(row.original.total)}</p>
            {row.original.discountTotal > 0 && (
              <p className="text-muted-foreground text-xs tabular-nums">giảm {formatVnd(row.original.discountTotal)}</p>
            )}
          </div>
        ),
      },
      {
        id: 'payments',
        header: 'Phương thức',
        cell: ({ row }) => row.original.paymentMethods.map((m) => paymentMethodLabels[m]).join(' + '),
      },
      {
        accessorKey: 'returnStatus',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <StatusBadge tone={orderReturnStatusVariants[row.original.returnStatus]}>
              {orderReturnStatusLabels[row.original.returnStatus]}
            </StatusBadge>
            {row.original.isExchange && <StatusBadge tone="info">Đổi hàng</StatusBadge>}
          </div>
        ),
      },
      {
        id: 'more',
        header: 'Ghi chú',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {[row.original.note, row.original.customerName, row.original.approvedByName && `duyệt: ${row.original.approvedByName}`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        ),
      },
    ],
    [seeAll]
  )

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Hóa đơn"
        icon={ReceiptText}
        description={seeAll ? 'Mọi hóa đơn của cửa hàng' : 'Hóa đơn trong các ca của bạn'}
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
        minWidth={960}
        sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
        pagination={data && { ...data, onPageChange: table.setPage, onPageSizeChange: table.setPageSize }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput onSearch={table.setSearch} placeholder="Mã hóa đơn, ghi chú…" className="w-64" />
            <RangeSelect
              value={range}
              onChange={(v) => {
                setRange(v)
                table.setPage(1)
              }}
            />
            <FilterSelect
              label="Phương thức"
              value={table.state.paymentMethod}
              options={paymentMethodLabels}
              onChange={(v) => table.setFilter('paymentMethod', v)}
            />
            <FilterSelect
              label="Trạng thái"
              value={table.state.returnStatus}
              options={orderReturnStatusLabels}
              onChange={(v) => table.setFilter('returnStatus', v)}
            />
          </div>
        }
        emptyState={<EmptyState title="Chưa có hóa đơn" description="Đổi khoảng ngày hoặc bộ lọc để xem thêm." />}
      />
      <OrderDetailSheet orderId={openId} onOpenChange={(open) => !open && setOpenId(null)} />
      <PrintPreviewHost />
    </div>
  )
}
