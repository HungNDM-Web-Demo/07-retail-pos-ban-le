'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ClipboardPen, SearchX, X } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { permissions } from '@/config/permissions'
import { adjustmentReasonLabels } from '@/config/retail-pos-labels'
import { FilterSelect } from '@/features/products/components/FilterSelect'
import { formatSignedVnd } from '@/features/products/lib/product-format'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AdjustmentReason, StockAdjustmentListItem } from '@/types/retail-pos'
import { useStockAdjustments } from '../hooks/use-stock'

type Filters = { from: string; to: string; reason: AdjustmentReason }

/** Tab Phiếu điều chỉnh (UC-13): danh sách phiếu, lọc ngày, lý do; bấm dòng xem chi tiết */
export function AdjustmentsTab({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) {
  const { can } = usePermissions()
  const canViewCost = can(permissions.products.viewCost)
  const table = useTableQuery<Filters>({ pageSize: 20 })
  const list = useStockAdjustments(table.query)
  const [searchKey, setSearchKey] = useState(0)
  const hasFilters = !!table.state.search || !!table.state.reason || !!table.state.from || !!table.state.to

  const columns = useMemo<ColumnDef<StockAdjustmentListItem>[]>(() => {
    const cols: ColumnDef<StockAdjustmentListItem>[] = [
      { id: 'code', header: 'Mã phiếu', cell: ({ row }) => <span className="font-mono font-medium">{row.original.code}</span> },
      { id: 'createdAt', header: 'Thời gian', cell: ({ row }) => <span className="tabular-nums">{formatDateTime(row.original.createdAt)}</span> },
      {
        id: 'reason',
        header: 'Lý do',
        cell: ({ row }) => (
          <StatusBadge tone={row.original.reason === 'DemLai' ? 'info' : row.original.reason === 'Khac' ? 'neutral' : 'warning'}>
            {adjustmentReasonLabels[row.original.reason]}
          </StatusBadge>
        ),
      },
      {
        id: 'note',
        header: 'Ghi chú',
        cell: ({ row }) => <span className="text-muted-foreground line-clamp-1 max-w-72 text-sm">{row.original.note ?? '—'}</span>,
      },
      { id: 'lineCount', header: 'Số dòng', meta: { className: 'text-right', headerClassName: 'text-right' }, cell: ({ row }) => row.original.lineCount },
      { id: 'createdByName', header: 'Người lập', cell: ({ row }) => <span className="text-sm">{row.original.createdByName}</span> },
    ]
    if (canViewCost)
      cols.push({
        id: 'totalValue',
        header: 'Giá trị',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => (
          <span className={cn('font-medium tabular-nums', row.original.totalValue < 0 && 'text-destructive')}>
            {formatSignedVnd(row.original.totalValue)}
          </span>
        ),
      })
    return cols
  }, [canViewCost])

  return (
    <DataTable
      columns={columns}
      data={list.data?.items}
      getRowId={(a) => a.id}
      isLoading={list.isLoading}
      isFetching={list.isFetching}
      error={list.error}
      onRetry={() => void list.refetch()}
      onRowClick={(a) => onOpen(a.id)}
      minWidth={960}
      pagination={list.data && { ...list.data, onPageChange: table.setPage, onPageSizeChange: table.setPageSize }}
      toolbar={
        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
          <SearchInput key={searchKey} value={table.state.search} onSearch={table.setSearch} placeholder="Tìm mã phiếu, ghi chú" className="lg:max-w-xs" />
          <div className="flex items-center gap-2">
            <Input type="date" value={table.state.from ?? ''} onChange={(e) => table.setFilter('from', e.target.value || undefined)} aria-label="Từ ngày" className="w-40" />
            <span className="text-muted-foreground" aria-hidden="true">
              →
            </span>
            <Input type="date" value={table.state.to ?? ''} onChange={(e) => table.setFilter('to', e.target.value || undefined)} aria-label="Đến ngày" className="w-40" />
          </div>
          <FilterSelect
            label="Lọc theo lý do"
            allLabel="Mọi lý do"
            value={table.state.reason}
            onChange={(v) => table.setFilter('reason', v)}
            options={(Object.keys(adjustmentReasonLabels) as AdjustmentReason[]).map((r) => ({ value: r, label: adjustmentReasonLabels[r] }))}
            className="lg:w-40"
          />
          <div className="flex gap-2 lg:ml-auto">
            {hasFilters && (
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => {
                  table.resetFilters()
                  setSearchKey((k) => k + 1)
                }}
              >
                <X aria-hidden="true" />
                Xóa lọc
              </Button>
            )}
            {can(permissions.stockAdjustments.create) && (
              <Button onClick={onCreate}>
                <ClipboardPen aria-hidden="true" />
                Lập phiếu điều chỉnh
              </Button>
            )}
          </div>
        </div>
      }
      emptyState={<EmptyState icon={SearchX} title="Không có phiếu điều chỉnh" description="Đổi khoảng ngày hoặc bỏ bớt bộ lọc." />}
    />
  )
}
