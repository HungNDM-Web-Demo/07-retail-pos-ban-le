'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, SearchX, X } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { permissions } from '@/config/permissions'
import { goodsReceiptStatusLabels, goodsReceiptStatusVariants } from '@/config/retail-pos-labels'
import { routePath, routeTo } from '@/config/route-path'
import { FilterSelect } from '@/features/products/components/FilterSelect'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatDate, formatDateTime, formatVnd } from '@/lib/format'
import type { GoodsReceiptListItem, GoodsReceiptStatus } from '@/types/retail-pos'
import { useGoodsReceipts, useSupplierOptions } from '../hooks/use-goods-receipts'

type Filters = { status: GoodsReceiptStatus; supplierId: string; from: string; to: string }

/** Tab Phiếu nhập (SCR-11): lọc trạng thái, nhà cung cấp, ngày nhập; bấm dòng mở phiếu */
export function ReceiptsTab() {
  const router = useRouter()
  const { can } = usePermissions()
  const table = useTableQuery<Filters>({ pageSize: 20 })
  const list = useGoodsReceipts(table.query)
  const suppliers = useSupplierOptions()
  const [searchKey, setSearchKey] = useState(0)
  const hasFilters = !!table.state.search || !!table.state.status || !!table.state.supplierId || !!table.state.from || !!table.state.to

  const columns = useMemo<ColumnDef<GoodsReceiptListItem>[]>(
    () => [
      { id: 'code', header: 'Mã phiếu', cell: ({ row }) => <span className="font-mono font-medium">{row.original.code}</span> },
      {
        id: 'receivedDate',
        header: 'Ngày nhập',
        enableSorting: true,
        cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.receivedDate)}</span>,
      },
      { id: 'supplierName', header: 'Nhà cung cấp', cell: ({ row }) => <span className="text-sm">{row.original.supplierName}</span> },
      {
        id: 'lineCount',
        header: 'Số dòng',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="tabular-nums">{row.original.lineCount}</span>,
      },
      {
        id: 'totalAmount',
        header: 'Tổng tiền',
        enableSorting: true,
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="font-medium tabular-nums">{formatVnd(row.original.totalAmount)}</span>,
      },
      {
        id: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <StatusBadge tone={goodsReceiptStatusVariants[row.original.status]}>{goodsReceiptStatusLabels[row.original.status]}</StatusBadge>
            {row.original.confirmedAt && <p className="text-muted-foreground text-xs tabular-nums">{formatDateTime(row.original.confirmedAt)}</p>}
          </div>
        ),
      },
    ],
    []
  )

  return (
    <DataTable
      columns={columns}
      data={list.data?.items}
      getRowId={(r) => r.id}
      isLoading={list.isLoading}
      isFetching={list.isFetching}
      error={list.error}
      onRetry={() => void list.refetch()}
      onRowClick={(r) => router.push(routeTo.goodsReceipt(r.id))}
      minWidth={900}
      sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
      pagination={list.data && { ...list.data, onPageChange: table.setPage, onPageSizeChange: table.setPageSize }}
      toolbar={
        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
          <SearchInput key={searchKey} value={table.state.search} onSearch={table.setSearch} placeholder="Tìm mã phiếu" className="lg:max-w-56" />
          <FilterSelect
            label="Lọc theo trạng thái"
            allLabel="Mọi trạng thái"
            value={table.state.status}
            onChange={(v) => table.setFilter('status', v)}
            options={(['Nhap', 'DaNhapKho'] as GoodsReceiptStatus[]).map((s) => ({ value: s, label: goodsReceiptStatusLabels[s] }))}
            className="lg:w-40"
          />
          <FilterSelect
            label="Lọc theo nhà cung cấp"
            allLabel="Mọi nhà cung cấp"
            value={table.state.supplierId}
            onChange={(v) => table.setFilter('supplierId', v)}
            options={(suppliers.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }))}
            className="lg:w-60"
          />
          <div className="flex items-center gap-2">
            <Input type="date" value={table.state.from ?? ''} onChange={(e) => table.setFilter('from', e.target.value || undefined)} aria-label="Nhập từ ngày" className="w-40" />
            <span className="text-muted-foreground" aria-hidden="true">
              →
            </span>
            <Input type="date" value={table.state.to ?? ''} onChange={(e) => table.setFilter('to', e.target.value || undefined)} aria-label="Nhập đến ngày" className="w-40" />
          </div>
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
            {can(permissions.goodsReceipts.create) && (
              <Button onClick={() => router.push(routePath.goodsReceiptNew)}>
                <Plus aria-hidden="true" />
                Tạo phiếu nhập
              </Button>
            )}
          </div>
        </div>
      }
      emptyState={<EmptyState icon={SearchX} title="Không có phiếu nhập khớp bộ lọc" />}
    />
  )
}
