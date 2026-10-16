'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { Ban, CircleCheck, MoreHorizontal, Pencil, Plus, SearchX, Tag, Trash2, TriangleAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Toggle } from '@/components/ui/toggle'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import {
  productStatusLabels,
  productStatusVariants,
  stockStatusLabels,
  stockStatusVariants,
} from '@/config/retail-pos-labels'
import { ProductImage } from '@/features/pos/components/ProductImage'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { getErrorMessage, isApiError } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductDto, ProductGroupDto, ProductStatus, StockStatus } from '@/types/retail-pos'
import { useDeleteProduct, useProducts, useSetProductStatus } from '../hooks/use-products'
import { MarginText } from '../lib/product-format'
import { FilterSelect } from './FilterSelect'
import { PrintLabelsDialog } from './PrintLabelsDialog'
import { ProductFormDialog } from './ProductFormDialog'

type Filters = { groupId: string; status: ProductStatus; stockStatus: StockStatus; lowMargin: boolean }

/**
 * Tab Mặt hàng (SCR-09, FR-06): tìm không dấu theo tên, mã hàng, mã vạch; lọc nhóm, trạng thái, tồn, biên lãi thấp.
 * Cột giá vốn, biên lãi ẩn khi thiếu `products.view-cost`. Chọn nhiều dòng để in tem (FR-07).
 */
export function ProductsTab({
  groups,
  initialStockStatus,
  initialGroupId,
}: {
  groups: ProductGroupDto[]
  initialStockStatus?: StockStatus
  initialGroupId?: string
}) {
  const { can } = usePermissions()
  const canViewCost = can(permissions.products.viewCost)
  const canCreate = can(permissions.products.create)
  const canUpdate = can(permissions.products.update)
  const canDelete = can(permissions.products.delete)

  const table = useTableQuery<Filters>({ pageSize: 20, stockStatus: initialStockStatus, groupId: initialGroupId })
  const products = useProducts(table.query)
  const setStatus = useSetProductStatus()
  const remove = useDeleteProduct()

  const [editing, setEditing] = useState<ProductDto | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<ProductDto | null>(null)
  const [selected, setSelected] = useState<Map<string, ProductDto>>(new Map())
  const [printOpen, setPrintOpen] = useState(false)
  const [searchKey, setSearchKey] = useState(0)

  const items = products.data?.items
  const allOnPage = !!items?.length && items.every((p) => selected.has(p.id))
  const someOnPage = !!items?.some((p) => selected.has(p.id))

  const toggle = (p: ProductDto, on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev)
      if (on) next.set(p.id, p)
      else next.delete(p.id)
      return next
    })
  const togglePage = (on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev)
      for (const p of items ?? []) {
        if (on) next.set(p.id, p)
        else next.delete(p.id)
      }
      return next
    })

  const openEdit = (p: ProductDto | null) => {
    setEditing(p)
    setFormOpen(true)
  }

  const changeStatus = (p: ProductDto, status: ProductStatus) =>
    setStatus.mutate(
      { id: p.id, status },
      {
        onSuccess: () => toast.success(status === 'NgungBan' ? `Đã ngừng bán ${p.name}` : `Đã bán lại ${p.name}`),
        onError: (e) => toast.error(getErrorMessage(e)),
      }
    )

  const confirmDelete = async () => {
    const p = deleting
    if (!p) return
    try {
      await remove.mutateAsync(p.id)
      toast.success(`Đã xóa ${p.name}`)
    } catch (error) {
      // TC-04: hàng đã có chứng từ → gợi ý chuyển Ngừng bán
      const hasDocs = isApiError(error) && error.problem.code === 'HangDaCoChungTu'
      toast.error(getErrorMessage(error), {
        action:
          hasDocs && p.status === 'DangBan'
            ? { label: 'Chuyển Ngừng bán', onClick: () => changeStatus(p, 'NgungBan') }
            : undefined,
      })
      setDeleting(null)
      throw error
    }
  }

  const hasFilters =
    !!table.state.search || !!table.state.groupId || !!table.state.status || !!table.state.stockStatus || !!table.state.lowMargin
  const clearFilters = () => {
    table.resetFilters()
    setSearchKey((k) => k + 1)
  }

  const columns = useMemo<ColumnDef<ProductDto>[]>(() => {
    const cols: ColumnDef<ProductDto>[] = [
      {
        id: 'select',
        header: () => (
          <Checkbox
            checked={allOnPage ? true : someOnPage ? 'indeterminate' : false}
            onCheckedChange={(v) => togglePage(v === true)}
            aria-label="Chọn mọi mặt hàng trong trang"
          />
        ),
        meta: { className: 'w-10', headerClassName: 'w-10' },
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selected.has(row.original.id)}
              onCheckedChange={(v) => toggle(row.original, v === true)}
              aria-label={`Chọn ${row.original.name}`}
            />
          </div>
        ),
      },
      {
        id: 'code',
        header: 'Mặt hàng',
        enableSorting: true,
        meta: { className: 'whitespace-normal' },
        cell: ({ row }) => {
          const p = row.original
          return (
            <div className="flex min-w-0 items-center gap-3">
              <ProductImage imageUrl={p.imageUrl} color={p.color} name={p.name} size="sm" />
              <div className="min-w-0">
                <p className={cn('line-clamp-2 max-w-56 font-medium whitespace-normal leading-snug', p.status === 'NgungBan' && 'text-muted-foreground line-through')}>
                  {p.name}
                </p>
                <p className="text-muted-foreground max-w-60 font-mono text-xs">
                  {p.code}
                  {p.barcode ? ` · ${p.barcode}` : ''}
                  {p.units.length > 1 ? ` · ${p.units.length - 1} ĐV quy đổi` : ''}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        id: 'groupName',
        header: 'Nhóm',
        meta: { className: 'whitespace-normal' },
        cell: ({ row }) => (
          <span className="inline-flex w-32 items-center gap-1.5 text-sm leading-tight">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.original.groupColor }} aria-hidden="true" />
            {row.original.groupName}
          </span>
        ),
      },
      {
        id: 'price',
        header: 'Giá bán',
        enableSorting: true,
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => (
          <span className="block leading-tight">
            <span className="font-medium tabular-nums">{formatVnd(row.original.price)}</span>
            <span className="text-muted-foreground block text-xs">/{row.original.baseUnit.toLowerCase()}</span>
          </span>
        ),
      },
    ]
    if (canViewCost) {
      cols.push(
        {
          id: 'avgCost',
          header: 'Giá vốn',
          enableSorting: true,
          meta: { className: 'text-right', headerClassName: 'text-right' },
          cell: ({ row }) => <span className="tabular-nums">{formatVnd(row.original.avgCost)}</span>,
        },
        {
          id: 'marginPct',
          header: 'Biên lãi',
          enableSorting: true,
          meta: { className: 'text-right', headerClassName: 'text-right' },
          cell: ({ row }) => <MarginText value={row.original.marginPct} />,
        }
      )
    }
    cols.push(
      {
        id: 'stock',
        header: 'Tồn',
        enableSorting: true,
        cell: ({ row }) => {
          const p = row.original
          return (
            <div className="space-y-1">
              <p className="text-sm tabular-nums">{p.stockText}</p>
              {p.stockStatus !== 'ConHang' && (
                <StatusBadge tone={stockStatusVariants[p.stockStatus]}>{stockStatusLabels[p.stockStatus]}</StatusBadge>
              )}
            </div>
          )
        },
      },
      {
        id: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <StatusBadge tone={productStatusVariants[row.original.status]}>{productStatusLabels[row.original.status]}</StatusBadge>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Thao tác</span>,
        meta: { className: 'w-12 text-right' },
        cell: ({ row }) => {
          const p = row.original
          if (!canUpdate && !canDelete) return null
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Thao tác với ${p.name}`}>
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {canUpdate && (
                    <>
                      <DropdownMenuItem onSelect={() => openEdit(p)}>
                        <Pencil aria-hidden="true" />
                        Sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          setSelected(new Map([[p.id, p]]))
                          setPrintOpen(true)
                        }}
                      >
                        <Tag aria-hidden="true" />
                        In tem
                      </DropdownMenuItem>
                      {p.status === 'DangBan' ? (
                        <DropdownMenuItem onSelect={() => changeStatus(p, 'NgungBan')}>
                          <Ban aria-hidden="true" />
                          Ngừng bán
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => changeStatus(p, 'DangBan')}>
                          <CircleCheck aria-hidden="true" />
                          Bán lại
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(p)}>
                        <Trash2 aria-hidden="true" />
                        Xóa
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      }
    )
    return cols
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewCost, canUpdate, canDelete, selected, allOnPage, someOnPage, items])

  const stockOptions = (Object.keys(stockStatusLabels) as StockStatus[]).map((s) => ({ value: s, label: stockStatusLabels[s] }))

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="bg-primary/5 border-primary/30 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5" role="status">
          <span className="text-sm font-medium">Đã chọn {selected.size} mặt hàng</span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Map())}>
              <X aria-hidden="true" />
              Bỏ chọn
            </Button>
            {canUpdate && (
              <Button size="sm" onClick={() => setPrintOpen(true)}>
                <Tag aria-hidden="true" />
                In tem mã vạch
              </Button>
            )}
          </div>
        </div>
      )}
      <DataTable
        columns={columns}
        data={items}
        getRowId={(p) => p.id}
        isLoading={products.isLoading}
        isFetching={products.isFetching}
        error={products.error}
        onRetry={() => void products.refetch()}
        onRowClick={canUpdate ? (p) => openEdit(p) : undefined}
        minWidth={canViewCost ? 1060 : 900}
        sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
        pagination={
          products.data && {
            ...products.data,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
            pageSizeOptions: [20, 50, 100],
          }
        }
        toolbar={
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            <SearchInput
              key={searchKey}
              value={table.state.search}
              onSearch={table.setSearch}
              placeholder="Tìm tên (gõ không dấu), mã hàng, mã vạch"
              className="lg:max-w-sm"
            />
            <FilterSelect
              label="Lọc theo nhóm hàng"
              allLabel="Mọi nhóm"
              value={table.state.groupId}
              onChange={(v) => table.setFilter('groupId', v)}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
              className="lg:w-52"
            />
            <FilterSelect
              label="Lọc theo trạng thái bán"
              allLabel="Mọi trạng thái"
              value={table.state.status}
              onChange={(v) => table.setFilter('status', v)}
              options={(['DangBan', 'NgungBan'] as ProductStatus[]).map((s) => ({ value: s, label: productStatusLabels[s] }))}
              className="lg:w-40"
            />
            <FilterSelect
              label="Lọc theo tồn"
              allLabel="Mọi mức tồn"
              value={table.state.stockStatus}
              onChange={(v) => table.setFilter('stockStatus', v)}
              options={stockOptions}
              className="lg:w-40"
            />
            {canViewCost && (
              <Toggle
                variant="outline"
                pressed={!!table.state.lowMargin}
                onPressedChange={(on) => table.setFilter('lowMargin', on || undefined)}
                aria-label="Chỉ hàng biên lãi dưới 5%"
                className="data-[state=on]:bg-warning/15 data-[state=on]:text-warning h-10 px-3"
              >
                <TriangleAlert aria-hidden="true" />
                Biên lãi dưới 5%
              </Toggle>
            )}
            <div className="flex gap-2 lg:ml-auto">
              {hasFilters && (
                <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                  <X aria-hidden="true" />
                  Xóa lọc
                </Button>
              )}
              {canCreate && (
                <Button onClick={() => openEdit(null)}>
                  <Plus aria-hidden="true" />
                  Thêm mặt hàng
                </Button>
              )}
            </div>
          </div>
        }
        emptyState={
          <EmptyState
            icon={SearchX}
            title={hasFilters ? 'Không có mặt hàng khớp bộ lọc' : 'Chưa có mặt hàng'}
            description={hasFilters ? 'Thử gõ không dấu, tìm theo mã vạch hoặc bỏ bớt bộ lọc.' : undefined}
            action={
              hasFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Xóa lọc
                </Button>
              ) : undefined
            }
          />
        }
      />
      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} groups={groups} defaultGroupId={table.state.groupId} />
      <PrintLabelsDialog open={printOpen} onOpenChange={setPrintOpen} products={[...selected.values()]} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Xóa ${deleting?.name ?? 'mặt hàng'}?`}
        description="Chỉ xóa được mặt hàng chưa có hóa đơn, phiếu nhập, điều chỉnh. Hàng đã bán thì chuyển Ngừng bán."
        confirmText="Xóa"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
      <p className="text-muted-foreground text-xs">
        Cần giá vốn mới? Lập <Link href={routePath.goodsReceiptNew} className="text-primary underline-offset-4 hover:underline">phiếu nhập</Link>: giá vốn bình quân tự tính lại.
      </p>
    </div>
  )
}
