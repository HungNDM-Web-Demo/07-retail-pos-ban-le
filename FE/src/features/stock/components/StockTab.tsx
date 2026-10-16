'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ClipboardPen, SearchX, X } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { permissions } from '@/config/permissions'
import { productStatusLabels, stockStatusLabels, stockStatusVariants } from '@/config/retail-pos-labels'
import { FilterSelect } from '@/features/products/components/FilterSelect'
import { formatSignedQty, formatSignedVnd } from '@/features/products/lib/product-format'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductGroupDto, StockItem, StockStatus } from '@/types/retail-pos'
import { useStock, useStockSummary } from '../hooks/use-stock'

type Filters = { groupId: string; status: StockStatus; includeInactive: boolean }

const STATUS_ORDER: StockStatus[] = ['AmKho', 'HetHang', 'SapHet', 'ConHang']

/**
 * Tab Tồn kho (SCR-10, FR-30): tồn đơn vị cơ bản kèm cách đọc quy đổi (BR-02), giá vốn bình quân, giá trị tồn,
 * trạng thái (BR-26). Dòng tổng đầu bảng từ `summary`; bấm dòng mở lịch sử biến động (FR-32).
 */
export function StockTab({
  groups,
  initialStatus,
  onRowClick,
  onAdjust,
  onShowLots,
}: {
  groups: ProductGroupDto[]
  initialStatus?: StockStatus
  onRowClick: (item: StockItem) => void
  onAdjust: () => void
  onShowLots: () => void
}) {
  const { can } = usePermissions()
  const canViewCost = can(permissions.products.viewCost)
  const canAdjust = can(permissions.stockAdjustments.create)
  const table = useTableQuery<Filters>({ pageSize: 20, status: initialStatus })
  const stock = useStock(table.query)
  const summary = useStockSummary({
    groupId: table.state.groupId,
    status: table.state.status,
    includeInactive: table.state.includeInactive,
  })
  const [searchKey, setSearchKey] = useState(0)
  const s = summary.data

  const hasFilters = !!table.state.search || !!table.state.groupId || !!table.state.status || !!table.state.includeInactive
  const clear = () => {
    table.resetFilters()
    setSearchKey((k) => k + 1)
  }

  const columns = useMemo<ColumnDef<StockItem>[]>(() => {
    const cols: ColumnDef<StockItem>[] = [
      {
        id: 'code',
        header: 'Mặt hàng',
        enableSorting: true,
        cell: ({ row }) => {
          const it = row.original
          return (
            <div className="min-w-0">
              <p className={cn('truncate font-medium', it.productStatus === 'NgungBan' && 'text-muted-foreground')}>
                {it.name}
                {it.productStatus === 'NgungBan' && (
                  <span className="text-muted-foreground ml-1.5 text-xs font-normal">({productStatusLabels.NgungBan})</span>
                )}
              </p>
              <p className="text-muted-foreground font-mono text-xs">{it.code}</p>
            </div>
          )
        },
      },
      { id: 'groupName', header: 'Nhóm', cell: ({ row }) => <span className="text-sm">{row.original.groupName}</span> },
      {
        id: 'stock',
        header: 'Tồn',
        enableSorting: true,
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => (
          <span className={cn('font-semibold tabular-nums', row.original.stock < 0 && 'text-destructive')}>
            {formatSignedQty(row.original.stock, false)}{' '}
            <span className="text-muted-foreground text-xs font-normal">{row.original.baseUnit.toLowerCase()}</span>
          </span>
        ),
      },
      {
        id: 'stockText',
        header: 'Đọc quy đổi',
        cell: ({ row }) => <span className="text-sm">{row.original.stockText}</span>,
      },
      {
        id: 'minStock',
        header: 'Tối thiểu',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{formatNumber(row.original.minStock, 0)}</span>,
      },
    ]
    if (canViewCost) {
      cols.push(
        {
          id: 'avgCost',
          header: 'Giá vốn BQ',
          enableSorting: true,
          meta: { className: 'text-right', headerClassName: 'text-right' },
          cell: ({ row }) => <span className="tabular-nums">{formatVnd(row.original.avgCost)}</span>,
        },
        {
          id: 'stockValue',
          header: 'Giá trị tồn',
          enableSorting: true,
          meta: { className: 'text-right', headerClassName: 'text-right' },
          cell: ({ row }) => (
            <span className={cn('font-medium tabular-nums', row.original.stockValue < 0 && 'text-destructive')}>
              {formatSignedVnd(row.original.stockValue)}
            </span>
          ),
        }
      )
    }
    cols.push({
      id: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => <StatusBadge tone={stockStatusVariants[row.original.status]}>{stockStatusLabels[row.original.status]}</StatusBadge>,
    })
    return cols
  }, [canViewCost])

  return (
    <div className="space-y-3">
      {/* Dòng tổng (FR-30) */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))_1.2fr]">
        {canViewCost && (
          <div className="bg-card rounded-xl border p-4 shadow-xs sm:col-span-2 xl:col-span-1">
            <p className="text-muted-foreground text-sm">Tổng giá trị tồn{table.state.groupId || table.state.status || table.state.includeInactive ? ' (theo bộ lọc)' : ''}</p>
            {s ? (
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatSignedVnd(s.totalValue)}</p>
            ) : (
              <Skeleton className="mt-2 h-7 w-40" />
            )}
            <p className="text-muted-foreground mt-1 text-xs">{s ? `${formatNumber(s.productCount, 0)} mặt hàng` : ' '}</p>
          </div>
        )}
        {STATUS_ORDER.map((st) => {
          const active = table.state.status === st
          return (
            <button
              key={st}
              type="button"
              onClick={() => table.setFilter('status', active ? undefined : st)}
              aria-pressed={active}
              className={cn(
                'bg-card hover:bg-muted/40 focus-visible:ring-ring/50 rounded-xl border p-4 text-left shadow-xs transition-colors outline-none focus-visible:ring-3',
                active && 'border-primary ring-primary/30 ring-2'
              )}
            >
              <StatusBadge tone={stockStatusVariants[st]}>{stockStatusLabels[st]}</StatusBadge>
              {s ? (
                <p className="mt-2 text-2xl font-semibold tabular-nums">{formatNumber(s.byStatus[st], 0)}</p>
              ) : (
                <Skeleton className="mt-2 h-7 w-12" />
              )}
              <p className="text-muted-foreground text-xs">mặt hàng đang bán</p>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onShowLots}
          className="bg-card hover:bg-muted/40 focus-visible:ring-ring/50 rounded-xl border p-4 text-left shadow-xs transition-colors outline-none focus-visible:ring-3"
        >
          <p className="text-muted-foreground text-sm">Lô hạn sử dụng</p>
          {s ? (
            <p className="mt-1 text-sm">
              <span className="text-warning text-2xl font-semibold tabular-nums">{s.expiringLotCount}</span> sắp hết hạn
              <br />
              <span className="text-destructive text-2xl font-semibold tabular-nums">{s.expiredLotCount}</span> đã hết hạn
            </p>
          ) : (
            <Skeleton className="mt-2 h-12 w-24" />
          )}
        </button>
      </div>

      <DataTable
        columns={columns}
        data={stock.data?.items}
        getRowId={(it) => it.productId}
        isLoading={stock.isLoading}
        isFetching={stock.isFetching}
        error={stock.error}
        onRetry={() => void stock.refetch()}
        onRowClick={onRowClick}
        minWidth={canViewCost ? 1080 : 860}
        sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
        pagination={stock.data && { ...stock.data, onPageChange: table.setPage, onPageSizeChange: table.setPageSize, pageSizeOptions: [20, 50, 100] }}
        toolbar={
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            <SearchInput key={searchKey} value={table.state.search} onSearch={table.setSearch} placeholder="Tìm tên (không dấu), mã hàng, mã vạch" className="lg:max-w-sm" />
            <FilterSelect
              label="Lọc theo nhóm hàng"
              allLabel="Mọi nhóm"
              value={table.state.groupId}
              onChange={(v) => table.setFilter('groupId', v)}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
              className="lg:w-52"
            />
            <FilterSelect
              label="Lọc theo trạng thái tồn"
              allLabel="Mọi trạng thái"
              value={table.state.status}
              onChange={(v) => table.setFilter('status', v)}
              options={STATUS_ORDER.map((st) => ({ value: st, label: stockStatusLabels[st] }))}
              className="lg:w-40"
            />
            <label className="flex h-10 items-center gap-2 text-sm">
              <Switch checked={!!table.state.includeInactive} onCheckedChange={(on) => table.setFilter('includeInactive', on || undefined)} />
              Gồm hàng ngừng bán
            </label>
            <div className="flex gap-2 lg:ml-auto">
              {hasFilters && (
                <Button variant="ghost" onClick={clear} className="text-muted-foreground">
                  <X aria-hidden="true" />
                  Xóa lọc
                </Button>
              )}
              {canAdjust && (
                <Button onClick={onAdjust}>
                  <ClipboardPen aria-hidden="true" />
                  Lập phiếu điều chỉnh
                </Button>
              )}
            </div>
          </div>
        }
        emptyState={<EmptyState icon={SearchX} title="Không có mặt hàng khớp bộ lọc" description="Thử gõ không dấu hoặc bỏ bớt bộ lọc." />}
      />
    </div>
  )
}
