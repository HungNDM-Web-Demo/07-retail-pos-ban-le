'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { ClipboardList, SearchX, X } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { permissions } from '@/config/permissions'
import { shiftStatusLabels, shiftStatusVariants } from '@/config/retail-pos-labels'
import { addDaysKey, vnTodayKey } from '@/features/pos/lib/vn-time'
import { FilterSelect } from '@/features/products/components/FilterSelect'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatDateTime, formatTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ShiftDto, ShiftStatus } from '@/types/retail-pos'
import { DifferenceText } from '../components/DifferenceText'
import { ShiftDetailSheet } from '../components/ShiftDetailSheet'
import { useShiftList } from '../hooks/use-shift-review'

type Filters = { from: string; to: string; status: ShiftStatus; cashierId: string }
const STATUSES = Object.keys(shiftStatusLabels) as ShiftStatus[]

/**
 * SCR-07 Danh sách ca (UC-10, FR-29): mặc định 7 ngày, lọc thu ngân, trạng thái, khoảng ngày; ca Cần kiểm tra nhãn đỏ.
 * `?status=CanKiemTra` mở sẵn bộ lọc. Bấm dòng mở chi tiết, ghi chú xử lý.
 */
export function ShiftsPage() {
  const search = useSearchParams()
  const statusParam = search.get('status') as ShiftStatus | null
  const today = vnTodayKey()
  const defaults = { from: addDaysKey(today, -6), to: today }
  const table = useTableQuery<Filters>({
    pageSize: 20,
    ...defaults,
    status: statusParam && STATUSES.includes(statusParam) ? statusParam : undefined,
  })
  const shifts = useShiftList(table.query)
  // Danh sách thu ngân cho bộ lọc: lấy từ ca 90 ngày gần nhất
  const recent = useShiftList({ from: addDaysKey(today, -89), to: today, pageSize: 100 })
  const cashiers = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of recent.data?.items ?? []) map.set(s.cashierId, s.cashierName)
    return [...map].map(([value, label]) => ({ value, label }))
  }, [recent.data])
  const [selected, setSelected] = useState<string | null>(null)

  const changed = !!table.state.status || !!table.state.cashierId || table.state.from !== defaults.from || table.state.to !== defaults.to

  const columns = useMemo<ColumnDef<ShiftDto>[]>(
    () => [
      {
        id: 'code',
        header: 'Ca',
        cell: ({ row }) => (
          <div>
            <p className="font-mono font-medium">{row.original.code}</p>
            <p className="text-muted-foreground text-xs">{row.original.cashierName}</p>
          </div>
        ),
      },
      {
        id: 'openedAt',
        header: 'Thời gian',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {formatDateTime(row.original.openedAt)} → {row.original.closedAt ? formatTime(row.original.closedAt) : 'đang mở'}
          </span>
        ),
      },
      {
        id: 'orderCount',
        header: 'HĐ / Trả',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.orderCount} / {row.original.returnCount}
          </span>
        ),
      },
      {
        id: 'netRevenue',
        header: 'Doanh thu thuần',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="font-medium tabular-nums">{formatVnd(row.original.netRevenue)}</span>,
      },
      {
        id: 'expectedCash',
        header: 'TM lý thuyết',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="tabular-nums">{formatVnd(row.original.expectedCash)}</span>,
      },
      {
        id: 'countedCash',
        header: 'Thực đếm',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="tabular-nums">{formatVnd(row.original.countedCash)}</span>,
      },
      {
        id: 'difference',
        header: 'Chênh lệch',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <DifferenceText value={row.original.difference} strong />,
      },
      {
        id: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => <StatusBadge tone={shiftStatusVariants[row.original.status]}>{shiftStatusLabels[row.original.status]}</StatusBadge>,
      },
    ],
    []
  )

  return (
    <PermissionGuard permission={permissions.shifts.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Ca làm"
          icon={ClipboardList}
          description="Theo dõi ca thu ngân, phát hiện và xử lý ca lệch tiền mặt quá 20.000 ₫."
          actions={
            <Button
              variant={table.state.status === 'CanKiemTra' ? 'default' : 'outline'}
              onClick={() => table.setFilter('status', table.state.status === 'CanKiemTra' ? undefined : 'CanKiemTra')}
              aria-pressed={table.state.status === 'CanKiemTra'}
            >
              Chỉ ca cần kiểm tra
            </Button>
          }
        />
        <DataTable
          columns={columns}
          data={shifts.data?.items}
          getRowId={(s) => s.id}
          isLoading={shifts.isLoading}
          isFetching={shifts.isFetching}
          error={shifts.error}
          onRetry={() => void shifts.refetch()}
          onRowClick={(s) => setSelected(s.id)}
          minWidth={1040}
          sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
          pagination={shifts.data && { ...shifts.data, onPageChange: table.setPage, onPageSizeChange: table.setPageSize }}
          toolbar={
            <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
              <div className="flex items-center gap-2">
                <Input type="date" value={table.state.from ?? ''} onChange={(e) => table.setFilter('from', e.target.value || undefined)} aria-label="Từ ngày" className="w-40" />
                <span className="text-muted-foreground" aria-hidden="true">
                  →
                </span>
                <Input type="date" value={table.state.to ?? ''} onChange={(e) => table.setFilter('to', e.target.value || undefined)} aria-label="Đến ngày" className="w-40" />
              </div>
              <FilterSelect
                label="Lọc theo thu ngân"
                allLabel="Mọi thu ngân"
                value={table.state.cashierId}
                onChange={(v) => table.setFilter('cashierId', v)}
                options={cashiers}
                className="lg:w-52"
              />
              <FilterSelect
                label="Lọc theo trạng thái"
                allLabel="Mọi trạng thái"
                value={table.state.status}
                onChange={(v) => table.setFilter('status', v)}
                options={STATUSES.map((s) => ({ value: s, label: shiftStatusLabels[s] }))}
                className="lg:w-44"
              />
              {changed && (
                <Button
                  variant="ghost"
                  className={cn('text-muted-foreground lg:ml-auto')}
                  onClick={() => {
                    table.resetFilters()
                    table.setFilter('from', defaults.from)
                    table.setFilter('to', defaults.to)
                  }}
                >
                  <X aria-hidden="true" />
                  Về 7 ngày gần nhất
                </Button>
              )}
            </div>
          }
          emptyState={<EmptyState icon={SearchX} title="Không có ca trong khoảng này" description="Đổi khoảng ngày hoặc bỏ bộ lọc." />}
        />
      </div>
      <ShiftDetailSheet shiftId={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </PermissionGuard>
  )
}
