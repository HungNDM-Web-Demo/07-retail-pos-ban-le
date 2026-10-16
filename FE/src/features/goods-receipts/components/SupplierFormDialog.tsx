'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import type { SupplierDto } from '@/types/retail-pos'
import { useSaveSupplier } from '../hooks/use-goods-receipts'
import { supplierSchema, type SupplierFormValues } from '../schemas/goods-receipt.schema'

const EMPTY: SupplierFormValues = { name: '', phone: '', address: '', note: '' }

/** Thêm, sửa nhà cung cấp; dùng cả cho "Thêm nhanh" trong form phiếu nhập (FR-34) */
export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier: SupplierDto | null
  onSaved?: (s: SupplierDto) => void
}) {
  const save = useSaveSupplier()
  const form = useForm<SupplierFormValues>({ resolver: zodResolver(supplierSchema), defaultValues: EMPTY })
  const { errors } = form.formState

  useEffect(() => {
    if (open)
      form.reset(
        supplier
          ? { name: supplier.name, phone: supplier.phone ?? '', address: supplier.address ?? '', note: supplier.note ?? '' }
          : EMPTY
      )
  }, [open, supplier, form])

  const onSubmit = form.handleSubmit((v) =>
    save.mutate(
      {
        id: supplier?.id,
        input: { name: v.name.trim(), phone: v.phone.trim() || undefined, address: v.address.trim() || undefined, note: v.note.trim() || undefined },
      },
      {
        onSuccess: (s) => {
          toast.success(supplier ? `Đã lưu ${s.name}` : `Đã thêm nhà cung cấp ${s.code}`)
          onSaved?.(s)
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplier ? `Sửa ${supplier.code}` : 'Thêm nhà cung cấp'}</DialogTitle>
          <DialogDescription>Đại lý, nhà phân phối giao hàng cho cửa hàng.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <FormField label="Tên nhà cung cấp" required error={errors.name?.message} className="sm:col-span-2">
            <Input autoComplete="off" placeholder="vd: Đại lý nước giải khát Tân Phát" {...form.register('name')} />
          </FormField>
          <FormField label="Số điện thoại" error={errors.phone?.message}>
            <Input inputMode="tel" autoComplete="off" placeholder="0905000101" {...form.register('phone')} />
          </FormField>
          <FormField label="Địa chỉ" error={errors.address?.message}>
            <Input autoComplete="off" {...form.register('address')} />
          </FormField>
          <FormField label="Ghi chú" error={errors.note?.message} className="sm:col-span-2">
            <Textarea rows={2} placeholder="vd: Giao thứ Hai, thứ Năm" {...form.register('note')} />
          </FormField>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {supplier ? 'Lưu' : 'Thêm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
