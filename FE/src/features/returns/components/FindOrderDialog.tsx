'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { searchCatalog } from '@/features/pos/lib/cart'
import { addDaysKey, vnTodayKey } from '@/features/pos/lib/vn-time'
import { formatDateTime, formatVnd } from '@/lib/format'
import type { PosCatalog } from '@/types/retail-pos'
import { useSourceOrders } from '../hooks/use-returns'

type FindOrderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog?: PosCatalog
  onPick: (code: string) => void
}

/** "Tìm hóa đơn" khi khách mất bill (UC-07 2a): lọc ngày mua, mặt hàng; chỉ hóa đơn trong 30 ngày chưa trả hết */
export function FindOrderDialog({ open, onOpenChange, catalog, onPick }: FindOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">{open && <Finder catalog={catalog} onPick={onPick} />}</DialogContent>
    </Dialog>
  )
}

function Finder({ catalog, onPick }: Pick<FindOrderDialogProps, 'catalog' | 'onPick'>) {
  const today = vnTodayKey()
  const [date, setDate] = useState(today)
  const [productText, setProductText] = useState('')
  const [productId, setProductId] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const hits = useMemo(() => {
    if (!productText || productId) return []
    const seen = new Set<string>()
    return searchCatalog(catalog, productText, 40)
      .filter((h) => !seen.has(h.item.productId) && seen.add(h.item.productId))
      .slice(0, 8)
  }, [catalog, productText, productId])
  const { data, isLoading } = useSourceOrders({ date: date || undefined, productId, page, pageSize: 8 }, true)

  return (
    <>
      <DialogHeader>
        <DialogTitle>Tìm hóa đơn</DialogTitle>
        <DialogDescription>Hóa đơn trong 30 ngày, chưa trả hết. Lọc theo ngày mua và mặt hàng khách mua.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Ngày mua" htmlFor="find-date">
          <Input
            id="find-date"
            type="date"
            min={addDaysKey(today, -30)}
            max={today}
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setPage(1)
            }}
            className="h-10"
          />
        </FormField>
        <FormField label="Mặt hàng" htmlFor="find-product">
          <div className="relative">
            <Input
              id="find-product"
              value={productText}
              onChange={(e) => {
                setProductText(e.target.value)
                setProductId(undefined)
                setPage(1)
              }}
              placeholder="Gõ tên hàng (không cần dấu)"
              className="h-10"
              autoComplete="off"
            />
            {hits.length > 0 && (
              <ul className="bg-popover absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border p-1 shadow-md">
                {hits.map((h) => (
                  <li key={h.item.productId}>
                    <button
                      type="button"
                      className="hover:bg-muted w-full rounded-md px-2 py-1.5 text-left text-sm"
                      onClick={() => {
                        setProductId(h.item.productId)
                        setProductText(h.item.name)
                      }}
                    >
                      {h.item.name} <span className="text-muted-foreground">· {h.item.code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </FormField>
      </div>
      <div className="max-h-[45vh] overflow-y-auto rounded-lg border">
        {isLoading ? (
          <Skeleton className="m-3 h-24" />
        ) : data?.items.length ? (
          <ul className="divide-y">
            {data.items.map((o) => (
              <li key={o.orderId}>
                <button
                  type="button"
                  onClick={() => onPick(o.code)}
                  className="hover:bg-muted flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left text-sm"
                >
                  <Search className="text-muted-foreground size-4" aria-hidden="true" />
                  <span className="font-medium tabular-nums">{o.code}</span>
                  <span className="text-muted-foreground">{formatDateTime(o.paidAt)}</span>
                  <span className="text-muted-foreground hidden sm:inline">{o.cashierName}</span>
                  <span className="ml-auto text-xs">{o.itemCount} món</span>
                  <span className="font-semibold tabular-nums">{formatVnd(o.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground p-4 text-sm">Không có hóa đơn phù hợp.</p>
        )}
      </div>
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={!data.hasPreviousPage} onClick={() => setPage((p) => p - 1)}>
            Trước
          </Button>
          <span className="tabular-nums">
            {data.page}/{data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={!data.hasNextPage} onClick={() => setPage((p) => p + 1)}>
            Sau
          </Button>
        </div>
      )}
    </>
  )
}
