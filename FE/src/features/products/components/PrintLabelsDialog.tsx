'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus, Printer, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatVnd } from '@/lib/format'
import type { ProductDto } from '@/types/retail-pos'
import { labelsHref } from '../lib/labels'

const MAX_COPIES = 99

/**
 * Chọn số tem cho từng đơn vị có mã vạch rồi mở trang xem trước `/products/labels` (FR-07, tem 40 × 30 mm).
 * Đơn vị chưa có mã vạch không in được: sửa mặt hàng, bấm "Sinh mã nội bộ".
 */
export function PrintLabelsDialog({
  open,
  onOpenChange,
  products,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: ProductDto[]
}) {
  const router = useRouter()
  const [copies, setCopies] = useState<Record<string, number>>({})

  // Mỗi lần mở: đơn vị cơ bản 1 tem, đơn vị quy đổi 0
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const init: Record<string, number> = {}
      for (const p of products) for (const u of p.units) init[u.id] = u.barcode && u.isBase ? 1 : 0
      setCopies(init)
    }
  }

  const total = Object.values(copies).reduce((s, n) => s + n, 0)
  const set = (id: string, n: number) => setCopies((c) => ({ ...c, [id]: Math.max(0, Math.min(MAX_COPIES, n)) }))

  const go = () => {
    const units = Object.entries(copies).filter(([, n]) => n > 0)
    router.push(labelsHref(products.map((p) => p.id), units))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>In tem mã vạch</DialogTitle>
          <DialogDescription>Tem 40 × 30 mm gồm tên, đơn vị, giá bán và mã vạch. Chọn số tem cho từng đơn vị.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(100dvh-14rem)] divide-y overflow-y-auto px-6">
          {products.map((p) => (
            <div key={p.id} className="py-3">
              <p className="font-medium">
                {p.name} <span className="text-muted-foreground font-mono text-xs">{p.code}</span>
              </p>
              <ul className="mt-2 space-y-1.5">
                {p.units.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 font-medium">{u.name}</span>
                    <span className="w-24 shrink-0 tabular-nums">{formatVnd(u.price)}</span>
                    {u.barcode ? (
                      <>
                        <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">{u.barcode}</span>
                        <div className="flex items-center gap-1" role="group" aria-label={`Số tem ${p.name} – ${u.name}`}>
                          <Button type="button" variant="outline" size="icon-sm" onClick={() => set(u.id, (copies[u.id] ?? 0) - 1)} aria-label="Bớt một tem">
                            <Minus aria-hidden="true" />
                          </Button>
                          <input
                            type="number"
                            min={0}
                            max={MAX_COPIES}
                            value={copies[u.id] ?? 0}
                            onChange={(e) => set(u.id, Number(e.target.value) || 0)}
                            className="border-input h-8 w-14 rounded-md border bg-transparent text-center text-sm tabular-nums"
                            aria-label={`Số tem ${u.name}`}
                          />
                          <Button type="button" variant="outline" size="icon-sm" onClick={() => set(u.id, (copies[u.id] ?? 0) + 1)} aria-label="Thêm một tem">
                            <Plus aria-hidden="true" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <span className="text-warning flex flex-1 items-center gap-1.5 text-xs">
                        <TriangleAlert className="size-3.5" aria-hidden="true" />
                        Chưa có mã vạch, sửa mặt hàng để sinh mã nội bộ
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <DialogFooter className="border-t px-6 py-4 sm:items-center">
          <p className="text-muted-foreground mr-auto text-sm">Tổng {total} tem</p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={go} disabled={total === 0}>
            <Printer aria-hidden="true" />
            Xem trước bản in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
