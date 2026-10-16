'use client'

import { useEffect } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Barcode, Loader2, Lock, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { permissions } from '@/config/permissions'
import { posRules } from '@/config/pos-rules'
import { productImageKinds, productImageUrl } from '@/config/retail-pos-labels'
import { ProductImage } from '@/features/pos/components/ProductImage'
import { marginPct } from '@/features/pos/lib/stock-math'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { applyFormErrors } from '@/features/pos/lib/problem'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductDto, ProductGroupDto, SaveProductRequest } from '@/types/retail-pos'
import { useInternalBarcode, useSaveProduct } from '../hooks/use-products'
import { formatPct, MarginText } from '../lib/product-format'
import { productSchema, type ProductFormValues } from '../schemas/product.schema'
import { NumberInput } from './NumberInput'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ProductDto | null
  groups: ProductGroupDto[]
  defaultGroupId?: string
}

const NO_IMAGE = '__none'
/** Form không có ô `imageUrl` (chọn qua kiểu ảnh) và `status` (công tắc): lỗi các khóa này hiện toast */
const isProductField = (key: string) => key !== 'imageUrl' && key !== 'status'
const SEED_IMAGE = /^\/seed\/products\/([a-z0-9-]+)\.webp$/

function toValues(p: ProductDto | null, groups: ProductGroupDto[], defaultGroupId?: string): ProductFormValues {
  if (!p) {
    const group = groups.find((g) => g.id === defaultGroupId) ?? groups.find((g) => !g.isHidden)
    return {
      name: '',
      groupId: group?.id ?? '',
      baseUnit: '',
      barcode: '',
      price: undefined as unknown as number,
      initialCost: 0,
      minStock: 0,
      trackExpiry: false,
      returnable: true,
      status: 'DangBan',
      imageKind: NO_IMAGE,
      color: group?.color ?? '#0369A1',
      units: [],
    }
  }
  return {
    name: p.name,
    groupId: p.groupId,
    baseUnit: p.baseUnit,
    barcode: p.barcode ?? '',
    price: p.price,
    initialCost: p.avgCost ?? 0,
    minStock: p.minStock,
    trackExpiry: p.trackExpiry,
    returnable: p.returnable,
    status: p.status,
    imageKind: p.imageUrl?.match(SEED_IMAGE)?.[1] ?? NO_IMAGE,
    color: p.color,
    units: p.units
      .filter((u) => !u.isBase)
      .map((u) => ({ id: u.id, name: u.name, factor: u.factor, barcode: u.barcode ?? '', price: u.price, everUsed: u.everUsed })),
  }
}

/**
 * Thêm, sửa mặt hàng (SCR-09, UC-01, FR-04, FR-05, FR-07). Mã vạch trùng (TC-02), giá sai bội số (TC-03)
 * gắn đúng ô; giá đơn vị lớn đắt hơn mua lẻ chỉ cảnh báo (BR-04). Đơn vị đã có chứng từ khóa hệ số, không xóa (BR-29).
 */
export function ProductFormDialog({ open, onOpenChange, product, groups, defaultGroupId }: Props) {
  const { can } = usePermissions()
  const canViewCost = can(permissions.products.viewCost)
  const save = useSaveProduct()
  const genBarcode = useInternalBarcode()

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: toValues(null, groups),
  })
  const units = useFieldArray({ control: form.control, name: 'units', keyName: 'key' })
  const { errors } = form.formState

  useEffect(() => {
    if (open) form.reset(toValues(product, groups, defaultGroupId))
    // groups chỉ dùng lấy nhóm mặc định lúc mở
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product, defaultGroupId, form])

  const [name, baseUnit, basePrice, cost, imageKind, color, unitValues, groupId] = useWatch({
    control: form.control,
    name: ['name', 'baseUnit', 'price', 'initialCost', 'imageKind', 'color', 'units', 'groupId'],
  })
  const effectiveCost = product ? (product.avgCost ?? 0) : (cost ?? 0)
  const margin = basePrice > 0 ? marginPct(basePrice, effectiveCost) : null

  const generate = (field: 'barcode' | `units.${number}.barcode`) =>
    genBarcode.mutate(undefined, {
      onSuccess: ({ barcode }) => {
        form.setValue(field, barcode, { shouldDirty: true, shouldValidate: true })
        toast.success(`Đã cấp mã nội bộ ${barcode}`)
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    })

  const onGroupChange = (id: string) => {
    const prev = groups.find((g) => g.id === groupId)
    const next = groups.find((g) => g.id === id)
    form.setValue('groupId', id, { shouldDirty: true, shouldValidate: true })
    // Màu ô ảnh đang theo màu nhóm cũ thì đổi theo nhóm mới
    if (next && (!prev || form.getValues('color').toLowerCase() === prev.color.toLowerCase())) {
      form.setValue('color', next.color, { shouldDirty: true })
    }
  }

  const onSubmit = form.handleSubmit((v) => {
    const keepUpload = product?.imageUrl && !SEED_IMAGE.test(product.imageUrl) ? product.imageUrl : undefined
    const input: SaveProductRequest = {
      name: v.name.trim(),
      groupId: v.groupId,
      baseUnit: v.baseUnit.trim(),
      barcode: v.barcode || undefined,
      price: v.price,
      initialCost: product ? undefined : v.initialCost,
      minStock: v.minStock,
      trackExpiry: v.trackExpiry,
      returnable: v.returnable,
      status: v.status,
      imageUrl: v.imageKind !== NO_IMAGE ? productImageUrl(v.imageKind) : keepUpload,
      color: v.color,
      units: v.units.map((u) => ({
        id: u.id,
        name: u.name.trim(),
        factor: u.factor,
        barcode: u.barcode || undefined,
        price: u.price,
      })),
    }
    save.mutate(
      { id: product?.id, input },
      {
        onSuccess: (saved) => {
          toast.success(product ? `Đã lưu ${saved.name}` : `Đã thêm ${saved.code} ${saved.name}`)
          onOpenChange(false)
        },
        onError: (error) => {
          applyFormErrors(form.setError, error, isProductField)
        },
      }
    )
  })

  const imageUrl =
    imageKind && imageKind !== NO_IMAGE
      ? productImageUrl(imageKind)
      : product?.imageUrl && !SEED_IMAGE.test(product.imageUrl)
        ? product.imageUrl
        : undefined

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{product ? `Sửa mặt hàng ${product.code}` : 'Thêm mặt hàng'}</DialogTitle>
          <DialogDescription>
            Tồn, giá vốn tính theo đơn vị cơ bản. Hóa đơn cũ giữ nguyên giá lúc bán khi bạn đổi giá.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="max-h-[calc(100dvh-13rem)] space-y-6 overflow-y-auto px-6 py-5">
            <div className="grid gap-5 md:grid-cols-[11rem_minmax(0,1fr)]">
              {/* Ảnh kiểu bao bì + màu nền */}
              <div className="space-y-3">
                <ProductImage
                  imageUrl={imageUrl}
                  color={color}
                  name={name || 'Mặt hàng'}
                  size="lg"
                  className="aspect-square h-auto w-full"
                />
                <FormField label="Kiểu ảnh">
                  <Controller
                    control={form.control}
                    name="imageKind"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value={NO_IMAGE}>Không có ảnh</SelectItem>
                          {Object.entries(productImageKinds).map(([k, label]) => (
                            <SelectItem key={k} value={k}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField label="Màu nền ô ảnh" error={errors.color?.message}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => form.setValue('color', e.target.value.toUpperCase(), { shouldDirty: true })}
                      className="h-10 w-12 cursor-pointer rounded-md border bg-transparent p-1"
                      aria-label="Chọn màu nền"
                    />
                    <Input className="font-mono uppercase" {...form.register('color')} />
                  </div>
                </FormField>
              </div>

              <div className="grid content-start gap-4 sm:grid-cols-2">
                <FormField label="Tên mặt hàng" required error={errors.name?.message} className="sm:col-span-2">
                  <Input autoComplete="off" placeholder="vd: Bia pilsner lon 330ml" {...form.register('name')} />
                </FormField>
                <FormField label="Nhóm hàng" required error={errors.groupId?.message}>
                  <Select value={groupId} onValueChange={onGroupChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn nhóm" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />
                          {g.name}
                          {g.isHidden ? ' (đang ẩn)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  label="Đơn vị cơ bản"
                  required
                  error={errors.baseUnit?.message}
                  hint="Đơn vị nhỏ nhất, tồn và giá vốn tính theo đơn vị này"
                >
                  <Input autoComplete="off" placeholder="vd: Lon, Gói, Hộp" {...form.register('baseUnit')} />
                </FormField>
                <FormField label="Mã vạch" error={errors.barcode?.message} hint="8–14 chữ số; để trống nếu hàng chưa có mã">
                  <div className="flex gap-2">
                    <Input inputMode="numeric" autoComplete="off" className="font-mono" {...form.register('barcode')} />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => generate('barcode')}
                      disabled={genBarcode.isPending}
                      title="Sinh mã nội bộ"
                    >
                      <Barcode aria-hidden="true" />
                      Sinh mã nội bộ
                    </Button>
                  </div>
                </FormField>
                <FormField label={`Giá bán (${baseUnit || 'đơn vị cơ bản'})`} required error={errors.price?.message} hint="Bội số của 500 ₫">
                  <Controller
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <NumberInput value={field.value} onValueChange={(v) => field.onChange(v ?? NaN)} suffix="₫" />
                    )}
                  />
                </FormField>
                {product ? (
                  canViewCost && (
                    <div className="grid gap-1.5">
                      <Label>Giá vốn bình quân</Label>
                      <p className="bg-muted/50 flex h-10 items-center justify-between rounded-md border px-3 text-sm">
                        <span className="tabular-nums">{formatVnd(product.avgCost)}</span>
                        <span className="text-muted-foreground text-xs">Đổi qua phiếu nhập</span>
                      </p>
                    </div>
                  )
                ) : (
                  <FormField
                    label="Giá vốn ban đầu"
                    error={errors.initialCost?.message}
                    hint="Giá vốn mỗi đơn vị cơ bản trước lần nhập đầu"
                  >
                    <Controller
                      control={form.control}
                      name="initialCost"
                      render={({ field }) => (
                        <NumberInput value={field.value} onValueChange={(v) => field.onChange(v ?? 0)} suffix="₫" />
                      )}
                    />
                  </FormField>
                )}
                <FormField label="Tồn tối thiểu" error={errors.minStock?.message} hint="Tồn bằng hoặc dưới mức này là Sắp hết">
                  <Controller
                    control={form.control}
                    name="minStock"
                    render={({ field }) => (
                      <NumberInput value={field.value} onValueChange={(v) => field.onChange(v ?? 0)} suffix={baseUnit ? baseUnit.toLowerCase() : undefined} />
                    )}
                  />
                </FormField>
                {canViewCost && (
                  <div className="grid gap-1.5">
                    <Label>Biên lãi</Label>
                    <p className="flex h-10 items-center text-sm">
                      {margin === null ? (
                        <span className="text-muted-foreground">Nhập giá bán để tính</span>
                      ) : (
                        <MarginText value={margin} />
                      )}
                    </p>
                  </div>
                )}
                <div className="grid gap-3 rounded-lg border p-3 sm:col-span-2 sm:grid-cols-3">
                  <SwitchRow
                    control={form.control}
                    name="trackExpiry"
                    label="Quản lý hạn sử dụng"
                    hint="Phiếu nhập bắt buộc nhập hạn"
                  />
                  <SwitchRow control={form.control} name="returnable" label="Cho đổi trả" hint="Tắt với hàng tươi, hàng cân" />
                  <Controller
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <label className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-sm font-medium">Đang bán</span>
                          <span className="text-muted-foreground block text-xs">Tắt là Ngừng bán, quét báo lỗi</span>
                        </span>
                        <Switch
                          checked={field.value === 'DangBan'}
                          onCheckedChange={(on) => field.onChange(on ? 'DangBan' : 'NgungBan')}
                        />
                      </label>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Đơn vị quy đổi (FR-05) */}
            <section className="space-y-3" aria-labelledby="units-title">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 id="units-title" className="font-semibold">
                    Đơn vị quy đổi
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Tối đa {posRules.maxConversionUnits} đơn vị, mỗi đơn vị có mã vạch và giá riêng (vd Lốc 6, Thùng 24).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={units.fields.length >= posRules.maxConversionUnits}
                  onClick={() => units.append({ name: '', factor: undefined as unknown as number, barcode: '', price: undefined as unknown as number })}
                >
                  <Plus aria-hidden="true" />
                  Thêm đơn vị
                </Button>
              </div>
              {errors.units?.message && <p className="text-destructive text-sm">{errors.units.message}</p>}
              {units.fields.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-5 text-center text-sm">
                  Chưa có đơn vị quy đổi. Hàng bán theo lốc, thùng thì thêm ở đây.
                </p>
              ) : (
                <div className="space-y-3">
                  {units.fields.map((field, i) => {
                    const u = unitValues?.[i]
                    const ref = basePrice > 0 && u?.factor > 0 ? basePrice * u.factor : null
                    const tooHigh = ref !== null && u?.price > ref
                    const locked = !!u?.everUsed
                    const e = errors.units?.[i]
                    return (
                      <div key={field.key} className="bg-muted/30 grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1.1fr)_6.5rem_minmax(0,1.5fr)_minmax(0,1.1fr)_auto]">
                        <FormField label="Tên đơn vị" required error={e?.name?.message}>
                          <Input autoComplete="off" placeholder="vd: Thùng 24" {...form.register(`units.${i}.name`)} />
                        </FormField>
                        <FormField label="Hệ số" required error={e?.factor?.message} hint={locked ? 'Đã có chứng từ' : baseUnit ? `Số ${baseUnit.toLowerCase()}` : undefined}>
                          <Controller
                            control={form.control}
                            name={`units.${i}.factor`}
                            render={({ field: f }) => (
                              <NumberInput value={f.value} onValueChange={(v) => f.onChange(v ?? NaN)} disabled={locked} />
                            )}
                          />
                        </FormField>
                        <FormField label="Mã vạch" error={e?.barcode?.message}>
                          <div className="flex gap-1.5">
                            <Input inputMode="numeric" autoComplete="off" className="font-mono" {...form.register(`units.${i}.barcode`)} />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => generate(`units.${i}.barcode`)}
                              disabled={genBarcode.isPending}
                              aria-label={`Sinh mã nội bộ cho đơn vị ${u?.name || i + 1}`}
                              title="Sinh mã nội bộ"
                            >
                              <Barcode aria-hidden="true" />
                            </Button>
                          </div>
                        </FormField>
                        <FormField
                          label="Giá bán"
                          required
                          error={e?.price?.message}
                          hint={ref !== null ? `Giá tham khảo ${formatVnd(ref)}` : undefined}
                        >
                          <Controller
                            control={form.control}
                            name={`units.${i}.price`}
                            render={({ field: f }) => (
                              <NumberInput
                                value={f.value}
                                onValueChange={(v) => f.onChange(v ?? NaN)}
                                suffix="₫"
                                className={cn(tooHigh && 'border-warning')}
                              />
                            )}
                          />
                        </FormField>
                        <div className="flex items-start sm:pt-6">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={locked}
                            onClick={() => units.remove(i)}
                            aria-label={`Xóa đơn vị ${u?.name || i + 1}`}
                            title={locked ? 'Đơn vị đã có trong chứng từ, không xóa' : 'Xóa đơn vị'}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            {locked ? <Lock aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                          </Button>
                        </div>
                        {tooHigh && (
                          <p className="text-warning flex items-center gap-1.5 text-sm sm:col-span-5" role="status">
                            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                            Mua theo đơn vị lớn đắt hơn mua lẻ. Giá tham khảo {formatVnd(ref)}, vẫn lưu được.
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
            {canViewCost && product && product.marginPct !== null && product.marginPct !== undefined && (
              <p className="text-muted-foreground text-xs">
                Biên lãi hiện tại {formatPct(product.marginPct)} theo giá vốn bình quân {formatVnd(product.avgCost)}.
              </p>
            )}
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {product ? 'Lưu thay đổi' : 'Thêm mặt hàng'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SwitchRow({
  control,
  name,
  label,
  hint,
}: {
  control: ReturnType<typeof useForm<ProductFormValues>>['control']
  name: 'trackExpiry' | 'returnable'
  label: string
  hint: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">{label}</span>
            <span className="text-muted-foreground block text-xs">{hint}</span>
          </span>
          <Switch checked={field.value} onCheckedChange={field.onChange} />
        </label>
      )}
    />
  )
}
