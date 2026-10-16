'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, UserRound } from 'lucide-react'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { customerService } from '@/features/customers/services/customer.service'
import { getErrorMessage, getFieldErrors, isApiError } from '@/lib/api-error'
import { formatPhone } from '@/lib/format'
import type { CustomerDto } from '@/types/retail-pos'

type CustomerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current?: { id: string; phone: string; name: string }
  canCreate: boolean
  onSelect: (customer: { id: string; phone: string; name: string } | undefined) => void
}

/** Khách hàng F4 (P3, BR-31): nhập SĐT → tra; chưa có thì thêm nhanh tên rồi gắn vào hóa đơn. */
export function CustomerDialog(props: CustomerDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">{props.open && <CustomerForm {...props} />}</DialogContent>
    </Dialog>
  )
}

function CustomerForm({ current, canCreate, onSelect }: CustomerDialogProps) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [found, setFound] = useState<CustomerDto | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lookup = useMutation({ mutationFn: customerService.byPhone })
  const create = useMutation({ mutationFn: customerService.create })

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFound(null)
    setNotFound(false)
    const value = phone.replace(/\D/g, '')
    if (!/^0\d{9}$/.test(value)) return setError('Số điện thoại gồm 10 chữ số, bắt đầu bằng 0')
    lookup.mutate(value, {
      onSuccess: setFound,
      onError: (err) => {
        if (isApiError(err) && err.status === 404) setNotFound(true)
        else setError(getErrorMessage(err))
      },
    })
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Nhập tên khách')
    create.mutate(
      { phone: phone.replace(/\D/g, ''), name: name.trim() },
      {
        onSuccess: (c) => onSelect({ id: c.id, phone: c.phone, name: c.name }),
        onError: (err) => setError(getFieldErrors(err).phone ?? getErrorMessage(err)),
      }
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <UserRound className="size-5" aria-hidden="true" /> Khách hàng
        </DialogTitle>
        <DialogDescription>Tích 1 điểm cho mỗi 20.000 ₫ thanh toán.</DialogDescription>
      </DialogHeader>
      {current && (
        <div className="bg-muted/60 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm">
          <span>
            Đang gắn: <strong>{current.name}</strong> · {formatPhone(current.phone)}
          </span>
          <Button variant="ghost" size="sm" onClick={() => onSelect(undefined)}>
            Bỏ khách
          </Button>
        </div>
      )}
      <form onSubmit={search} className="flex items-end gap-2">
        <FormField label="Số điện thoại" htmlFor="customer-phone" className="flex-1">
          <Input
            id="customer-phone"
            autoFocus
            inputMode="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setNotFound(false)
              setFound(null)
            }}
            className="h-11 text-lg tabular-nums"
            placeholder="09…"
          />
        </FormField>
        <Button type="submit" className="h-11" disabled={lookup.isPending}>
          {lookup.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Tra cứu
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {found && (
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <p className="font-semibold">{found.name}</p>
            <p className="text-muted-foreground text-sm">
              {formatPhone(found.phone)} · {found.points} điểm · {found.orderCount} lần mua
            </p>
          </div>
          <Button autoFocus onClick={() => onSelect({ id: found.id, phone: found.phone, name: found.name })}>
            Gắn vào hóa đơn
          </Button>
        </div>
      )}
      {notFound && (
        <form onSubmit={add} className="grid gap-3 rounded-lg border p-3">
          <p className="text-sm">Chưa có khách với số {phone.replace(/\D/g, '')}.</p>
          {canCreate ? (
            <>
              <FormField label="Tên khách" htmlFor="customer-name" required>
                <Input id="customer-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
              </FormField>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                Thêm nhanh và gắn
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Bạn không có quyền thêm khách.</p>
          )}
        </form>
      )}
    </>
  )
}
