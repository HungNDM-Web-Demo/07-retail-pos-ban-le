'use client'

import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowUp, EyeOff, GripVertical, Loader2, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductGroupDto } from '@/types/retail-pos'
import { useReorderGroups, useSaveProductGroup, useSetGroupVisibility } from '../hooks/use-products'
import { productGroupSchema, type ProductGroupFormValues } from '../schemas/product.schema'

/**
 * Tab Nhóm hàng (FR-03, UC-01 1a): kéo thả hoặc bấm mũi tên đổi thứ tự, sửa tên, màu, công tắc ẩn.
 * Không có xóa nhóm (chỉ ẩn khỏi bộ lọc ở màn bán hàng; hàng bên trong vẫn quét được).
 */
export function ProductGroupsTab({
  groups,
  isLoading,
  error,
  onRetry,
  onOpenGroup,
}: {
  groups: ProductGroupDto[] | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
  onOpenGroup: (groupId: string) => void
}) {
  const { can } = usePermissions()
  const canCreate = can(permissions.products.create)
  const canUpdate = can(permissions.products.update)
  const reorder = useReorderGroups()
  const visibility = useSetGroupVisibility()
  const [order, setOrder] = useState<ProductGroupDto[]>(groups ?? [])
  const [dragId, setDragId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ProductGroupDto | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  // Đồng bộ thứ tự hiển thị khi dữ liệu nhóm đổi (đặt state trong lúc render, không dùng effect)
  const [source, setSource] = useState(groups)
  if (groups !== source) {
    setSource(groups)
    if (groups) setOrder(groups)
  }

  const commit = (next: ProductGroupDto[]) => {
    setOrder(next)
    reorder.mutate(
      next.map((g) => g.id),
      {
        onSuccess: () => toast.success('Đã lưu thứ tự nhóm hàng'),
        onError: (e) => {
          toast.error(getErrorMessage(e))
          if (groups) setOrder(groups)
        },
      }
    )
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return
    const next = [...order]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    commit(next)
  }

  const toggleHidden = (g: ProductGroupDto, hidden: boolean) =>
    visibility.mutate(
      { id: g.id, isHidden: hidden },
      {
        onSuccess: () => toast.success(hidden ? `Đã ẩn nhóm ${g.name}` : `Đã hiện nhóm ${g.name}`),
        onError: (e) => toast.error(getErrorMessage(e)),
      }
    )

  if (error) return <ErrorState error={error} onRetry={onRetry} />

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Thứ tự nhóm là thứ tự nút lọc ở màn bán hàng. Kéo biểu tượng
          <GripVertical className="mx-0.5 inline size-4 align-text-bottom" aria-hidden="true" />
          hoặc bấm mũi tên để đổi.
        </p>
        {canCreate && (
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus aria-hidden="true" />
            Thêm nhóm hàng
          </Button>
        )}
      </div>
      <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-8 rounded-lg" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>
        ) : order.length === 0 ? (
          <EmptyState title="Chưa có nhóm hàng" />
        ) : (
          <ol className="divide-y" aria-label="Nhóm hàng theo thứ tự">
            {order.map((g, i) => (
              <li
                key={g.id}
                draggable={canUpdate}
                onDragStart={(e) => {
                  setDragId(g.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  if (dragId) e.preventDefault()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = order.findIndex((x) => x.id === dragId)
                  setDragId(null)
                  if (from >= 0) move(from, i)
                }}
                onDragEnd={() => setDragId(null)}
                className={cn(
                  'flex flex-wrap items-center gap-3 px-4 py-2.5 transition-colors',
                  dragId === g.id && 'bg-primary/5 opacity-60',
                  g.isHidden && 'bg-muted/40'
                )}
              >
                {canUpdate && (
                  <span className="text-muted-foreground cursor-grab active:cursor-grabbing" aria-hidden="true">
                    <GripVertical className="size-4" />
                  </span>
                )}
                <span className="text-muted-foreground w-6 text-right text-sm tabular-nums">{i + 1}</span>
                <span className="size-8 shrink-0 rounded-lg border" style={{ backgroundColor: g.color }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className={cn('font-medium', g.isHidden && 'text-muted-foreground')}>{g.name}</p>
                  <p className="text-muted-foreground text-xs">
                    <span className="font-mono">{g.code}</span> ·{' '}
                    <button type="button" className="hover:text-primary underline-offset-2 hover:underline" onClick={() => onOpenGroup(g.id)}>
                      {formatNumber(g.productCount, 0)} mặt hàng
                    </button>
                  </p>
                </div>
                {g.isHidden && (
                  <StatusBadge tone="neutral" icon={<EyeOff className="size-3" aria-hidden="true" />}>
                    Đang ẩn
                  </StatusBadge>
                )}
                {canUpdate && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => move(i, i - 1)} disabled={i === 0 || reorder.isPending} aria-label={`Đưa ${g.name} lên`}>
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => move(i, i + 1)}
                      disabled={i === order.length - 1 || reorder.isPending}
                      aria-label={`Đưa ${g.name} xuống`}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <label className="ml-2 flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Hiện</span>
                      <Switch checked={!g.isHidden} onCheckedChange={(on) => toggleHidden(g, !on)} aria-label={`Hiện nhóm ${g.name}`} />
                    </label>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditing(g)
                        setFormOpen(true)
                      }}
                      aria-label={`Sửa nhóm ${g.name}`}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
      <GroupFormDialog open={formOpen} onOpenChange={setFormOpen} group={editing} />
    </div>
  )
}

const PRESET_COLORS = ['#D97706', '#DC2626', '#0284C7', '#DB2777', '#A16207', '#65A30D', '#16A34A', '#E11D48', '#7C3AED', '#0D9488']

function GroupFormDialog({ open, onOpenChange, group }: { open: boolean; onOpenChange: (o: boolean) => void; group: ProductGroupDto | null }) {
  const save = useSaveProductGroup()
  const form = useForm<ProductGroupFormValues>({ resolver: zodResolver(productGroupSchema), defaultValues: { name: '', color: PRESET_COLORS[0] } })
  const color = useWatch({ control: form.control, name: 'color' })

  useEffect(() => {
    if (open) form.reset(group ? { name: group.name, color: group.color } : { name: '', color: PRESET_COLORS[0] })
  }, [open, group, form])

  const onSubmit = form.handleSubmit((v) =>
    save.mutate(
      { id: group?.id, input: { name: v.name.trim(), color: v.color.toUpperCase() } },
      {
        onSuccess: (g) => {
          toast.success(group ? `Đã lưu nhóm ${g.name}` : `Đã thêm nhóm ${g.name}`)
          onOpenChange(false)
        },
        onError: (e) => {
          if (!applyFieldErrors(form.setError, e)) toast.error(getErrorMessage(e))
        },
      }
    )
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{group ? `Sửa nhóm ${group.code}` : 'Thêm nhóm hàng'}</DialogTitle>
          <DialogDescription>Màu nhóm là màu nút lọc và màu nền mặc định ô ảnh của mặt hàng trong nhóm.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormField label="Tên nhóm hàng" required error={form.formState.errors.name?.message}>
            <Input autoComplete="off" placeholder="vd: Đồ uống có cồn" {...form.register('name')} />
          </FormField>
          <FormField label="Màu" required error={form.formState.errors.color?.message}>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => form.setValue('color', c, { shouldDirty: true, shouldValidate: true })}
                  className={cn(
                    'focus-visible:ring-ring/50 size-8 rounded-full border-2 outline-none focus-visible:ring-3',
                    color.toUpperCase() === c ? 'border-foreground' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Màu ${c}`}
                  aria-pressed={color.toUpperCase() === c}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => form.setValue('color', e.target.value.toUpperCase(), { shouldDirty: true, shouldValidate: true })}
                className="h-8 w-10 cursor-pointer rounded-md border bg-transparent p-0.5"
                aria-label="Chọn màu khác"
              />
            </div>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {group ? 'Lưu' : 'Thêm nhóm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
