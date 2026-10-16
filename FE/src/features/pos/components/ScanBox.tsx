'use client'

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ScanBarcode, X } from 'lucide-react'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PosCatalog } from '@/types/retail-pos'
import { searchCatalog, type CatalogHit } from '../lib/cart'
import { REFOCUS_EVENT } from '../lib/print'
import { Kbd } from './Kbd'
import { ProductImage } from './ProductImage'

export type ScanBoxHandle = {
  focus: () => void
  /** F2: mở gợi ý tìm tên */
  openSearch: () => void
}

type ScanBoxProps = {
  catalog?: PosCatalog
  disabled?: boolean
  /** Tiền tố n* đang chờ áp cho lần thêm kế tiếp */
  pendingQty?: number | null
  onClearPending: () => void
  /** Enter khi không chọn gợi ý: chuỗi gõ (mã vạch, n*, …) */
  onSubmitText: (text: string) => void
  /** Chọn một gợi ý; `text` là chuỗi đang gõ (có thể có tiền tố n*) */
  onPick: (hit: CatalogHit, text: string) => void
  /** Mũi tên lên/xuống khi không có gợi ý: chọn dòng giỏ */
  onArrow: (dir: 1 | -1) => void
  /** Delete khi ô trống: xóa dòng đang chọn */
  onDeleteLine: () => void
}

const PREFIX = /^[^*\s]{1,8}\*/

/**
 * Ô quét lớn luôn có con trỏ (FR-08): gõ mã + Enter như máy quét; gõ chữ mở gợi ý tên không dấu (FR-10),
 * mỗi gợi ý là một đơn vị "{tên} – {đơn vị} {giá}".
 */
export const ScanBox = forwardRef<ScanBoxHandle, ScanBoxProps>(function ScanBox(
  { catalog, disabled, pendingQty, onClearPending, onSubmitText, onPick, onArrow, onDeleteLine },
  ref
) {
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [forceOpen, setForceOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const onRefocus = () =>
      setTimeout(() => {
        if (!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) input.current?.focus()
      }, 0)
    window.addEventListener(REFOCUS_EVENT, onRefocus)
    return () => window.removeEventListener(REFOCUS_EVENT, onRefocus)
  }, [])

  useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
    openSearch: () => {
      setForceOpen(true)
      setDismissed(false)
      input.current?.focus()
    },
  }))

  const query = text.replace(PREFIX, '').trim()
  const isText = !!query && !/^\d+$/.test(query)
  const hits = useMemo(() => (isText && !dismissed ? searchCatalog(catalog, query) : []), [isText, dismissed, catalog, query])
  const showList = !disabled && (hits.length > 0 || (forceOpen && !dismissed))
  const current = Math.min(active, Math.max(0, hits.length - 1))

  const reset = () => {
    setText('')
    setActive(0)
    setForceOpen(false)
    setDismissed(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const dir = e.key === 'ArrowDown' ? 1 : -1
      if (hits.length) setActive((a) => (Math.min(a, hits.length - 1) + dir + hits.length) % hits.length)
      else onArrow(dir)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (hits.length) {
        onPick(hits[current], text)
        reset()
      } else if (text.trim() && !isText) {
        // Mã vạch, tiền tố n*: xử lý rồi xóa trắng ô; chữ không khớp gợi ý thì giữ để sửa
        onSubmitText(text)
        reset()
      }
    } else if (e.key === 'Escape') {
      if (showList || text) {
        e.preventDefault()
        e.stopPropagation()
        if (showList) setDismissed(true)
        else setText('')
      } else if (pendingQty) {
        onClearPending()
      }
    } else if (e.key === 'Delete' && !text) {
      e.preventDefault()
      onDeleteLine()
    }
  }

  return (
    <div className="relative">
      <ScanBarcode
        className="text-primary pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2"
        aria-hidden="true"
      />
      {pendingQty ? (
        <button
          type="button"
          onClick={onClearPending}
          className="bg-primary text-primary-foreground absolute top-1/2 left-12 z-10 flex h-8 -translate-y-1/2 items-center gap-1 rounded-md px-2 text-sm font-bold tabular-nums"
          aria-label={`Bỏ số lượng ${pendingQty}`}
        >
          ×{pendingQty}
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
      <input
        ref={input}
        role="combobox"
        aria-expanded={showList}
        aria-controls="scan-suggestions"
        aria-label="Quét mã vạch hoặc gõ tên hàng"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setActive(0)
          setDismissed(false)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setForceOpen(false)}
        placeholder={disabled ? 'Mở ca để bắt đầu bán hàng' : 'Quét mã vạch, gõ tên hàng hoặc "12*" rồi quét…'}
        className={cn(
          'border-input bg-card focus-visible:border-primary focus-visible:ring-primary/30 h-14 w-full rounded-xl border-2 pr-20 text-lg font-medium shadow-xs transition-colors placeholder:text-base placeholder:font-normal focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60',
          pendingQty ? 'pl-28' : 'pl-13'
        )}
      />
      <Kbd className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2">F2</Kbd>
      {showList && (
        <ul
          id="scan-suggestions"
          role="listbox"
          className="bg-popover absolute inset-x-0 top-full z-30 mt-1 max-h-[22rem] overflow-y-auto rounded-xl border p-1 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {hits.length === 0 ? (
            <li className="text-muted-foreground px-3 py-3 text-sm">
              {query ? `Không tìm thấy hàng "${query}"` : 'Gõ tên hoặc mã hàng (không cần dấu) để tìm'}
            </li>
          ) : (
            hits.map((hit, i) => {
              const inactive = hit.item.status !== 'DangBan'
              return (
                <li
                  key={`${hit.item.productId}:${hit.unit.unitId}`}
                  role="option"
                  aria-selected={i === current}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    onPick(hit, text)
                    reset()
                  }}
                  className={cn(
                    'flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5',
                    i === current && 'bg-primary/10',
                    inactive && 'opacity-60'
                  )}
                >
                  <ProductImage name={hit.item.name} imageUrl={hit.item.imageUrl} color={hit.item.color} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {hit.item.name} – {hit.unit.name}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {hit.item.code}
                      {hit.unit.barcode ? ` · ${hit.unit.barcode}` : ''}
                      {inactive ? ' · Ngừng bán' : ''}
                    </span>
                  </span>
                  <span className="text-base font-semibold tabular-nums">{formatVnd(hit.unit.price)}</span>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
})
