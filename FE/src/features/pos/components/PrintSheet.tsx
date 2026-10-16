'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReceiptPaperSize, StoreProfile } from '@/types/retail-pos'
import { signalPrintReady } from '../lib/print'
import { vnFormatDateTime } from '../lib/vn-time'

type PrintSheetProps = {
  paperSize: ReceiptPaperSize
  /** Dữ liệu đã đủ để in */
  ready: boolean
  error?: string | null
  children: React.ReactNode
}

/**
 * Khung bản in nhiệt (07 §4.4, NFR-05): khổ 80 mm hoặc 58 mm (`@page size`), chữ ≥ 11 px ở 58 mm.
 * `?print=1` gọi in khi vẽ xong (trong iframe thì báo trang cha); `?reprint=1` thêm dòng "IN LẠI …".
 */
export function PrintSheet({ paperSize, ready, error, children }: PrintSheetProps) {
  const params = useSearchParams()
  const autoPrint = params.get('print') === '1'
  const printed = useRef(false)
  useEffect(() => {
    if (!ready || !autoPrint || printed.current) return
    printed.current = true
    // Chờ mã vạch SVG, ảnh logo vẽ xong
    const t = setTimeout(signalPrintReady, 250)
    return () => clearTimeout(t)
  }, [ready, autoPrint])

  const width = paperSize === '58' ? '58mm' : '80mm'
  return (
    <div className="flex min-h-svh flex-col items-center gap-4 bg-white py-6 print:block print:py-0">
      <style>{`@page { size: ${width} auto; margin: 0; }`}</style>
      <div className="no-print flex gap-2">
        <Button variant="outline" onClick={() => window.print()} disabled={!ready}>
          <Printer aria-hidden="true" /> In
        </Button>
      </div>
      <article
        className="receipt bg-white text-black shadow-md ring-1 ring-black/10 print:shadow-none print:ring-0"
        style={{
          width,
          padding: paperSize === '58' ? '3mm 2mm' : '4mm 4mm',
          fontSize: paperSize === '58' ? 11 : 12,
          lineHeight: 1.35,
          fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
        }}
      >
        {error ? (
          <p className="text-center">{error}</p>
        ) : ready ? (
          children
        ) : (
          <p className="flex items-center justify-center gap-2 py-6">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Đang tải…
          </p>
        )}
      </article>
    </div>
  )
}

/** Đầu bản in: tên, địa chỉ, SĐT, MST cửa hàng */
export function ReceiptHeader({ store, title }: { store?: StoreProfile; title: string }) {
  return (
    <header className="text-center">
      <p className="text-[1.25em] font-bold uppercase">{store?.name}</p>
      {store?.address && <p>{store.address}</p>}
      {store?.phone && <p>ĐT: {store.phone}</p>}
      {store?.taxCode && <p>MST: {store.taxCode}</p>}
      <p className="mt-2 text-[1.15em] font-bold">{title}</p>
    </header>
  )
}

/** Dòng "IN LẠI dd/MM/yyyy HH:mm" khi `?reprint=1` */
export function ReprintMark() {
  const params = useSearchParams()
  const [printedAt] = useState(() => vnFormatDateTime(Date.now()))
  if (params.get('reprint') !== '1') return null
  return <p className="my-1 text-center font-bold">IN LẠI {printedAt}</p>
}

export function Rule() {
  return <hr className="my-1.5 border-0 border-t border-dashed border-black" />
}

export function Row({ label, value, strong }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between gap-2 text-[1.15em] font-bold' : 'flex justify-between gap-2'}>
      <span>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  )
}
