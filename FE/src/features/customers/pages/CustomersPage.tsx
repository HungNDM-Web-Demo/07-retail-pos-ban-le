'use client'

import { useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2, Plus, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { FormField } from '@/components/shared/FormField'
import { PageHeader } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatDate, formatDateTime, formatPhone, formatVnd } from '@/lib/format'
import type { CustomerDto, CustomerQuery } from '@/types/retail-pos'
import { customerService } from '../services/customer.service'

/** Khách hàng `/customers` (SCR-14, P3): tra cứu, điểm tích lũy (BR-31), lịch sử mua, thêm nhanh */
export function CustomersPage() {
  const { can } = usePermissions()
  const table = useTableQuery<CustomerQuery>({ pageSize: 20 })
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['customers', table.query],
    queryFn: () => customerService.list(table.query),
    placeholderData: keepPreviousData,
  })
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<CustomerDto | null>(null)

  const columns = useMemo<ColumnDef<CustomerDto>[]>(
    () => [
      { accessorKey: 'name', header: 'Tên khách', enableSorting: true, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { accessorKey: 'phone', header: 'Số điện thoại', cell: ({ row }) => formatPhone(row.original.phone) },
      { accessorKey: 'points', header: 'Điểm', enableSorting: true, cell: ({ row }) => <span className="tabular-nums">{row.original.points}</span> },
      { accessorKey: 'orderCount', header: 'Số lần mua', enableSorting: true, cell: ({ row }) => <span className="tabular-nums">{row.original.orderCount}</span> },
      { accessorKey: 'totalSpent', header: 'Tổng chi tiêu', enableSorting: true, cell: ({ row }) => <span className="tabular-nums">{formatVnd(row.original.totalSpent)}</span> },
      { accessorKey: 'lastOrderAt', header: 'Mua gần nhất', enableSorting: true, cell: ({ row }) => formatDateTime(row.original.lastOrderAt) },
      { accessorKey: 'createdAt', header: 'Ngày thêm', cell: ({ row }) => formatDate(row.original.createdAt) },
    ],
    []
  )

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Khách hàng"
        icon={UserRound}
        description="Khách thân thiết, 1 điểm cho mỗi 20.000 ₫ thanh toán"
        actions={
          can(permissions.customers.create) && (
            <Button onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" /> Thêm khách
            </Button>
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
        onRowClick={setOpen}
        minWidth={820}
        sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
        pagination={data && { ...data, onPageChange: table.setPage, onPageSizeChange: table.setPageSize }}
        toolbar={<SearchInput onSearch={table.setSearch} placeholder="Tên, số điện thoại…" className="w-64" />}
        emptyState={<EmptyState title="Chưa có khách" />}
      />
      <AddCustomerDialog open={adding} onOpenChange={setAdding} />
      <CustomerOrdersSheet customer={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function AddCustomerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient()
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useMutation({
    mutationFn: customerService.create,
    onSuccess: (c) => {
      toast.success(`Đã thêm khách ${c.name}`)
      void qc.invalidateQueries({ queryKey: ['customers'] })
      onOpenChange(false)
      setPhone('')
      setName('')
    },
    onError: (err) => {
      const fields = getFieldErrors(err)
      setErrors(Object.keys(fields).length ? fields : { name: getErrorMessage(err) })
    },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm khách</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            setErrors({})
            create.mutate({ phone: phone.replace(/\D/g, ''), name: name.trim() })
          }}
        >
          <FormField label="Số điện thoại" htmlFor="new-phone" required error={errors.phone}>
            <Input id="new-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormField>
          <FormField label="Tên khách" htmlFor="new-name" required error={errors.name}>
            <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Thêm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CustomerOrdersSheet({ customer, onClose }: { customer: CustomerDto | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['customers', 'orders', customer?.id],
    queryFn: () => customerService.orders(customer!.id, { page: 1, pageSize: 50 }),
    enabled: !!customer,
  })
  return (
    <Sheet open={!!customer} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{customer?.name}</SheetTitle>
          <SheetDescription>
            {customer && `${formatPhone(customer.phone)} · ${customer.points} điểm · ${customer.orderCount} lần mua`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : data?.items.length ? (
            <ul className="divide-y text-sm">
              {data.items.map((o) => (
                <li key={o.id} className="flex justify-between gap-3 py-2">
                  <span>
                    <span className="font-medium tabular-nums">{o.code}</span>
                    <span className="text-muted-foreground"> · {formatDateTime(o.paidAt)}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatVnd(o.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Chưa có hóa đơn.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
