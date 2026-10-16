'use client'

import { useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Printer, Tag } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { routePath } from '@/config/route-path'
import { BarcodeSvg } from '@/features/pos/components/BarcodeSvg'
import { isValidEan13 } from '@/features/pos/lib/barcode'
import { formatVnd } from '@/lib/format'
import type { ProductDto } from '@/types/retail-pos'
import { useProductsByIds } from '../hooks/use-products'
import { parseLabelParams } from '../lib/labels'

type Label = { key: string; name: string; unit: string; price: number; barcode: string }

function buildLabels(products: ProductDto[], copies: number, units: Map<string, number> | null): Label[] {
  const labels: Label[] = []
  for (const p of products) {
    for (const u of p.units) {
      if (!u.barcode) continue
      const n = units ? (units.get(u.id) ?? 0) : u.isBase ? copies : 0
      for (let i = 0; i < n; i++) {
        labels.push({ key: `${u.id}-${i}`, name: p.name, unit: u.name, price: u.price, barcode: u.barcode })
      }
    }
  }
  return labels
}

/**
 * Bản in tem mã vạch 40 × 30 mm (FR-07, 07 §4.6): tên, đơn vị, giá, mã vạch EAN-13 (Code 128 khi mã không đủ 13 số
 * hợp lệ). Màn hình hiện bản xem trước; chỉ in khi bấm "In tem" (hoặc `?print=1`).
 */
export function ProductLabelsPage() {
  const search = useSearchParams()
  const request = useMemo(() => parseLabelParams(new URLSearchParams(search.toString())), [search])
  const query = useProductsByIds(request.ids)
  const labels = useMemo(
    () => (query.data ? buildLabels(query.data, request.copies, request.units) : []),
    [query.data, request]
  )

  const printed = useRef(false)
  useEffect(() => {
    if (search.get('print') === '1' && labels.length > 0 && !printed.current) {
      printed.current = true
      const t = setTimeout(() => window.print(), 300)
      return () => clearTimeout(t)
    }
  }, [labels.length, search])

  return (
    <div className="label-print bg-muted/40 min-h-dvh">
      <style>{`
        @page { size: 40mm 30mm; margin: 0; }
        @media print {
          .label-print { background: none !important; min-height: 0 !important; }
          .label-toolbar { display: none !important; }
          .label-sheet { display: block !important; padding: 0 !important; gap: 0 !important; }
          .label { box-shadow: none !important; border: 0 !important; border-radius: 0 !important; break-after: page; page-break-after: always; }
          .label:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      <header className="label-toolbar bg-background sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Button variant="ghost" asChild>
            <Link href={routePath.products}>
              <ArrowLeft aria-hidden="true" />
              Hàng hóa
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold">In tem mã vạch</h1>
            <p className="text-muted-foreground text-sm">
              {labels.length} tem 40 × 30 mm. Máy in tem: chọn khổ giấy 40 × 30 mm, lề 0.
            </p>
          </div>
          <Button className="ml-auto" onClick={() => window.print()} disabled={labels.length === 0}>
            <Printer aria-hidden="true" />
            In tem
          </Button>
        </div>
      </header>

      {query.isLoading ? (
        <div className="mx-auto grid max-w-6xl grid-cols-[repeat(auto-fill,minmax(40mm,1fr))] gap-4 p-6">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[30mm] w-[40mm]" />
          ))}
        </div>
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : labels.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Không có tem để in"
          description="Mặt hàng đã chọn chưa có mã vạch hoặc số tem là 0. Quay lại Hàng hóa để chọn lại."
        />
      ) : (
        <div className="label-sheet mx-auto flex max-w-6xl flex-wrap content-start gap-4 p-6">
          {labels.map((l) => (
            <article
              key={l.key}
              className="label flex h-[30mm] w-[40mm] flex-col overflow-hidden rounded-sm border bg-white px-[1.5mm] pt-[1.2mm] pb-[0.8mm] text-black shadow-sm"
              aria-label={`${l.name} – ${l.unit} ${formatVnd(l.price)}`}
            >
              <p className="line-clamp-2 text-[7.5pt] leading-[1.15] font-semibold">{l.name}</p>
              <div className="mt-[0.5mm] flex items-baseline justify-between gap-1">
                <span className="truncate text-[6.5pt]">{l.unit}</span>
                <span className="text-[10pt] leading-none font-bold tabular-nums">{formatVnd(l.price)}</span>
              </div>
              <div className="mt-auto flex justify-center">
                <BarcodeSvg
                  value={l.barcode}
                  format={isValidEan13(l.barcode) ? 'EAN13' : 'CODE128'}
                  height={30}
                  width={1.2}
                  fontSize={11}
                  className="h-[13mm] w-full"
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
