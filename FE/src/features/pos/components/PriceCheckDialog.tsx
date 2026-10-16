'use client'

import { useState } from 'react'
import { ScanBarcode, Tag } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { stockStatusLabels, stockStatusVariants } from '@/config/retail-pos-labels'
import { formatVnd } from '@/lib/format'
import type { PosCatalog, PosCatalogItem } from '@/types/retail-pos'
import { searchCatalog, type CatalogIndex } from '../lib/cart'
import { beepError, beepOk } from '../lib/sound'
import { stockStatus, stockText } from '../lib/stock-math'
import { useScanner } from '../hooks/use-scanner'
import { ProductImage } from './ProductImage'

type PriceCheckDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog?: PosCatalog
  index: CatalogIndex
}

/** Kiểm tra giá F3 (UC-04, TC-20): ô quét riêng; tên, giá mọi đơn vị, tồn quy đổi. Không đổi giỏ. */
export function PriceCheckDialog({ open, onOpenChange, catalog, index }: PriceCheckDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <PriceCheck catalog={catalog} index={index} />}
      </DialogContent>
    </Dialog>
  )
}

function PriceCheck({ catalog, index }: { catalog?: PosCatalog; index: CatalogIndex }) {
  const [text, setText] = useState('')
  const [item, setItem] = useState<PosCatalogItem | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const lookup = (value: string) => {
    const v = value.trim()
    if (!v) return
    const hit = /^\d{8,14}$/.test(v) ? index.byBarcode.get(v)?.item : searchCatalog(catalog, v, 1)[0]?.item
    if (hit) {
      beepOk()
      setItem(hit)
      setMessage(null)
    } else {
      beepError()
      setItem(null)
      setMessage(/^\d+$/.test(v) ? `Không tìm thấy mã vạch ${v}` : `Không tìm thấy hàng "${v}"`)
    }
    setText('')
  }
  useScanner(lookup)

  const status = item ? stockStatus(item.stock, item.minStock) : null
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Tag className="size-5" aria-hidden="true" /> Kiểm tra giá
        </DialogTitle>
        <DialogDescription>Quét mã hoặc gõ tên rồi Enter. Không thêm vào hóa đơn.</DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          lookup(text)
        }}
        className="relative"
      >
        <ScanBarcode className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2" aria-hidden="true" />
        <Input
          autoFocus
          aria-label="Mã vạch hoặc tên hàng"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-12 pl-11 text-lg"
          placeholder="Quét mã vạch…"
          autoComplete="off"
        />
      </form>
      {message && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {message}
        </p>
      )}
      {item && (
        <div className="grid gap-3 rounded-xl border p-3">
          <div className="flex items-start gap-3">
            <ProductImage name={item.name} imageUrl={item.imageUrl} color={item.color} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-lg leading-tight font-semibold">{item.name}</p>
              <p className="text-muted-foreground text-sm">{item.code}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {item.status === 'NgungBan' ? (
                  <StatusBadge tone="neutral">Hàng ngừng bán</StatusBadge>
                ) : (
                  status && <StatusBadge tone={stockStatusVariants[status]}>{stockStatusLabels[status]}</StatusBadge>
                )}
                <span className="text-sm">
                  Tồn <strong className="tabular-nums">{stockText(item.stock, item.units)}</strong>
                </span>
              </div>
            </div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {item.units.map((u) => (
                <tr key={u.unitId} className="border-t first:border-t-0">
                  <td className="py-1.5 font-medium">{u.name}</td>
                  <td className="text-muted-foreground py-1.5 font-mono text-xs">{u.barcode ?? '—'}</td>
                  <td className="py-1.5 text-right text-base font-semibold tabular-nums">{formatVnd(u.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
