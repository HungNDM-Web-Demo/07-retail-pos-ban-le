'use client'

import { useMemo } from 'react'
import { Copy, ScanBarcode, Shuffle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatVnd } from '@/lib/format'
import type { PosCatalog } from '@/types/retail-pos'
import type { CatalogHit, CatalogIndex } from '../lib/cart'

/** 11 mã của hàng trong test case (07 §4.2 mục 2, 06 §5.6) */
export const TEST_BARCODES = [
  '8939010001214', // Bia lon
  '8939010001221', // Bia lốc 6
  '8939010001238', // Bia thùng 24
  '8939020003116', // Mì gói
  '8939020003123', // Mì thùng 30
  '8939030004516', // Sữa tươi hộp
  '8939030004523', // Sữa tươi lốc 4
  '8939030004530', // Sữa tươi thùng 48
  '8939010005816', // Nước suối chai
  '8939030007715', // Sữa bột
  '2000000000015', // Trứng gà
]

/** Mã đơn vị cơ bản của hàng đang bán còn tồn (DemoToolbar "Quét mã ngẫu nhiên", bảng mã ngẫu nhiên) */
export function randomBarcodes(catalog: PosCatalog | undefined, count: number, exclude: string[] = []): string[] {
  const pool = (catalog?.items ?? [])
    .filter((i) => i.status === 'DangBan' && i.stock > 0 && i.units[0]?.barcode && !exclude.includes(i.units[0].barcode!))
    .map((i) => i.units[0].barcode!)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

type SampleBarcodesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog?: PosCatalog
  index: CatalogIndex
  /** Bấm mã = quét mã (đi đúng đường xử lý của ô quét, kể cả tiền tố n*) */
  onScan: (barcode: string) => void
}

/** Bảng "Mã vạch mẫu" cho người xem không có máy quét (07 §4.2 mục 2) */
export function SampleBarcodesDialog({ open, onOpenChange, catalog, index, onScan }: SampleBarcodesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {open && <Sample catalog={catalog} index={index} onScan={onScan} />}
      </DialogContent>
    </Dialog>
  )
}

function Sample({ catalog, index, onScan }: Pick<SampleBarcodesDialogProps, 'catalog' | 'index' | 'onScan'>) {
  // Đổi mỗi lần mở (component gắn lại khi mở)
  const random = useMemo(() => randomBarcodes(catalog, 12, TEST_BARCODES), [catalog])
  const row = (code: string) => {
    const hit = index.byBarcode.get(code)
    return <CodeRow key={code} code={code} hit={hit} onScan={onScan} />
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ScanBarcode className="size-5" aria-hidden="true" /> Mã vạch mẫu
        </DialogTitle>
        <DialogDescription>
          Bấm một mã để quét như máy quét (gõ trước &quot;12*&quot; ở ô quét để quét 12 cái). Có máy quét thật: in tem ở
          Hàng hóa rồi quét tem.
        </DialogDescription>
      </DialogHeader>
      <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1 md:grid-cols-2">
        <section>
          <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">Hàng trong test case</h3>
          <ul className="grid gap-1.5">{TEST_BARCODES.map(row)}</ul>
        </section>
        <section>
          <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <Shuffle className="size-3.5" aria-hidden="true" /> Ngẫu nhiên từ danh mục
          </h3>
          <ul className="grid gap-1.5">{random.map(row)}</ul>
        </section>
      </div>
    </>
  )
}

function CodeRow({ code, hit, onScan }: { code: string; hit?: CatalogHit; onScan: (code: string) => void }) {
  return (
    <li className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={() => onScan(code)}
        className="hover:bg-muted focus-visible:ring-ring/50 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md border px-3 py-1.5 text-left transition-colors focus-visible:ring-3 focus-visible:outline-none"
      >
        <span className="font-mono text-sm tabular-nums">{code}</span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {hit ? `${hit.item.name} – ${hit.unit.name}` : 'Không có trong danh mục'}
        </span>
        {hit && <span className="text-sm font-semibold tabular-nums">{formatVnd(hit.unit.price)}</span>}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-auto"
        aria-label={`Sao chép mã ${code}`}
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(
            () => toast.success(`Đã sao chép ${code}`),
            () => toast.error('Không sao chép được')
          )
        }}
      >
        <Copy />
      </Button>
    </li>
  )
}
