'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PackageSearch } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FilterSelect } from '@/features/products/components/FilterSelect'
import { useProductGroups } from '@/features/products/hooks/use-products'
import { formatPct, formatSignedQty, formatSignedVnd } from '@/features/products/lib/product-format'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductProfitRow, ProductSortBy } from '@/types/retail-pos'
import { useProductReport } from '../hooks/use-reports'
import { displayDateKey } from '../lib/date-range'
import { excelSheet, reportFileName, type ExcelColumn } from '../lib/export-excel'
import { reportService } from '../services/report.service'
import { ExportButton, type ReportTabProps } from './ReportParts'

const SORTS: { value: ProductSortBy; label: string }[] = [
  { value: 'grossProfit', label: 'Lợi nhuận gộp' },
  { value: 'netRevenue', label: 'Doanh thu thuần' },
  { value: 'quantity', label: 'Số lượng' },
]

const COLUMNS: ExcelColumn<ProductProfitRow>[] = [
  { header: 'Hạng', value: (r) => r.rank, width: 7 },
  { header: 'Mã hàng', value: (r) => r.code, width: 10 },
  { header: 'Tên hàng', value: (r) => r.name, width: 36 },
  { header: 'Nhóm', value: (r) => r.groupName, width: 24 },
  { header: 'Đơn vị cơ bản', value: (r) => r.baseUnit, width: 12 },
  { header: 'Số lượng bán thuần', value: (r) => r.quantity, width: 16 },
  { header: 'Doanh thu thuần', value: (r) => r.netRevenue, width: 16 },
  { header: 'Giá vốn', value: (r) => r.cogs, width: 15 },
  { header: 'Lợi nhuận gộp', value: (r) => r.grossProfit, width: 15 },
  { header: 'Biên lãi gộp (%)', value: (r) => r.marginPct, width: 14, format: '0.0' },
]

/** Tab Theo mặt hàng (FR-37): xếp hạng bán chạy theo số lượng, doanh thu thuần hoặc lợi nhuận gộp; lọc nhóm */
export function ProductRankTab({ range, enabled }: ReportTabProps) {
  const groups = useProductGroups()
  const [sortBy, setSortBy] = useState<ProductSortBy>('grossProfit')
  const [groupId, setGroupId] = useState<string | undefined>()
  const [page, setPage] = useState({ page: 1, pageSize: 20 })
  const query = { ...range, sortBy, groupId, ...page }
  const report = useProductReport(query, enabled)

  const columns = useMemo<ColumnDef<ProductProfitRow>[]>(
    () => [
      { id: 'rank', header: '#', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.rank}</span> },
      {
        id: 'name',
        header: 'Mặt hàng',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="text-muted-foreground text-xs">
              <span className="font-mono">{row.original.code}</span> · {row.original.groupName}
            </p>
          </div>
        ),
      },
      {
        id: 'quantity',
        header: 'SL bán thuần',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => (
          <span className={cn('tabular-nums', sortBy === 'quantity' && 'font-semibold')}>
            {formatSignedQty(row.original.quantity, false)} <span className="text-muted-foreground text-xs">{row.original.baseUnit.toLowerCase()}</span>
          </span>
        ),
      },
      {
        id: 'netRevenue',
        header: 'Doanh thu thuần',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className={cn('tabular-nums', sortBy === 'netRevenue' && 'font-semibold')}>{formatVnd(row.original.netRevenue)}</span>,
      },
      {
        id: 'cogs',
        header: 'Giá vốn',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="tabular-nums">{formatVnd(row.original.cogs)}</span>,
      },
      {
        id: 'grossProfit',
        header: 'Lợi nhuận gộp',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => (
          <span className={cn('tabular-nums', sortBy === 'grossProfit' && 'font-semibold', row.original.grossProfit < 0 && 'text-destructive')}>
            {formatSignedVnd(row.original.grossProfit)}
          </span>
        ),
      },
      {
        id: 'marginPct',
        header: 'Biên lãi',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="tabular-nums">{formatPct(row.original.marginPct)}</span>,
      },
    ],
    [sortBy]
  )

  /** Xuất mọi dòng (tải lần lượt từng trang 100 dòng) */
  const buildAll = async () => {
    const rows: ProductProfitRow[] = []
    for (let p = 1; ; p++) {
      const res = await reportService.products({ ...range, sortBy, groupId, page: p, pageSize: 100 })
      rows.push(...res.items)
      if (!res.hasNextPage) break
    }
    const label = SORTS.find((s) => s.value === sortBy)?.label.toLowerCase()
    return [excelSheet('Theo mặt hàng', `Xếp hạng theo ${label} ${displayDateKey(range.from)} - ${displayDateKey(range.to)}`, COLUMNS, rows)]
  }

  return (
    <DataTable
      columns={columns}
      data={report.data?.items}
      getRowId={(r) => r.productId}
      isLoading={report.isLoading}
      isFetching={report.isFetching}
      error={report.error}
      onRetry={() => void report.refetch()}
      minWidth={960}
      pagination={
        report.data && {
          ...report.data,
          onPageChange: (p) => setPage((s) => ({ ...s, page: p })),
          onPageSizeChange: (n) => setPage({ page: 1, pageSize: n }),
          pageSizeOptions: [20, 50, 100],
        }
      }
      toolbar={
        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
          <span className="text-muted-foreground text-sm">Xếp hạng theo</span>
          <ToggleGroup
            type="single"
            variant="outline"
            value={sortBy}
            onValueChange={(v) => {
              if (!v) return
              setSortBy(v as ProductSortBy)
              setPage((s) => ({ ...s, page: 1 }))
            }}
            aria-label="Xếp hạng theo"
          >
            {SORTS.map((s) => (
              <ToggleGroupItem key={s.value} value={s.value} className="px-3">
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FilterSelect
            label="Lọc theo nhóm hàng"
            allLabel="Mọi nhóm"
            value={groupId}
            onChange={(v) => {
              setGroupId(v)
              setPage((s) => ({ ...s, page: 1 }))
            }}
            options={(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
            className="lg:w-56"
          />
          <div className="lg:ml-auto">
            <ExportButton fileName={reportFileName('mat-hang', range.from, range.to)} disabled={!report.data?.totalCount} build={buildAll} />
          </div>
        </div>
      }
      emptyState={<EmptyState icon={PackageSearch} title="Không có mặt hàng bán trong khoảng này" />}
    />
  )
}
