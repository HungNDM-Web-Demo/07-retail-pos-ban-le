'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Truck } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatDate, formatPhone, formatVnd } from '@/lib/format'
import type { SupplierDto } from '@/types/retail-pos'
import { useSuppliers } from '../hooks/use-goods-receipts'
import { SupplierFormDialog } from './SupplierFormDialog'

/** Tab Nhà cung cấp (SCR-11): số phiếu đã nhập kho, tổng tiền nhập, lần nhập gần nhất */
export function SuppliersTab() {
  const { can } = usePermissions()
  const table = useTableQuery({ pageSize: 20, sortBy: 'code', sortDir: 'asc' })
  const list = useSuppliers(table.query)
  const [editing, setEditing] = useState<SupplierDto | null>(null)
  const [open, setOpen] = useState(false)

  const columns = useMemo<ColumnDef<SupplierDto>[]>(
    () => [
      {
        id: 'code',
        header: 'Nhà cung cấp',
        enableSorting: true,
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-muted-foreground font-mono text-xs">{row.original.code}</p>
          </div>
        ),
      },
      { id: 'phone', header: 'Điện thoại', cell: ({ row }) => <span className="tabular-nums">{formatPhone(row.original.phone)}</span> },
      {
        id: 'address',
        header: 'Địa chỉ, ghi chú',
        cell: ({ row }) => (
          <div className="max-w-80 text-sm">
            <p className="line-clamp-1">{row.original.address ?? '—'}</p>
            {row.original.note && <p className="text-muted-foreground line-clamp-1 text-xs">{row.original.note}</p>}
          </div>
        ),
      },
      {
        id: 'receiptCount',
        header: 'Phiếu đã nhập',
        enableSorting: true,
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="tabular-nums">{row.original.receiptCount}</span>,
      },
      {
        id: 'totalPurchased',
        header: 'Tổng tiền nhập',
        enableSorting: true,
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="font-medium tabular-nums">{formatVnd(row.original.totalPurchased)}</span>,
      },
      {
        id: 'lastReceiptAt',
        header: 'Nhập gần nhất',
        enableSorting: true,
        cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.lastReceiptAt, 'Chưa nhập')}</span>,
      },
    ],
    []
  )

  return (
    <>
      <DataTable
        columns={columns}
        data={list.data?.items}
        getRowId={(s) => s.id}
        isLoading={list.isLoading}
        isFetching={list.isFetching}
        error={list.error}
        onRetry={() => void list.refetch()}
        onRowClick={
          can(permissions.suppliers.update)
            ? (s) => {
                setEditing(s)
                setOpen(true)
              }
            : undefined
        }
        minWidth={960}
        sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
        pagination={list.data && { ...list.data, onPageChange: table.setPage, onPageSizeChange: table.setPageSize }}
        toolbar={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput value={table.state.search} onSearch={table.setSearch} placeholder="Tìm tên, mã, số điện thoại" />
            {can(permissions.suppliers.create) && (
              <Button
                className="sm:ml-auto"
                onClick={() => {
                  setEditing(null)
                  setOpen(true)
                }}
              >
                <Plus aria-hidden="true" />
                Thêm nhà cung cấp
              </Button>
            )}
          </div>
        }
        emptyState={<EmptyState icon={Truck} title="Chưa có nhà cung cấp khớp" />}
      />
      <SupplierFormDialog open={open} onOpenChange={setOpen} supplier={editing} />
    </>
  )
}
