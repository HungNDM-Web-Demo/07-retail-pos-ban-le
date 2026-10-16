'use client'

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { Loader2, ScanBarcode } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { ProductImage } from '@/features/pos/components/ProductImage'
import { useDebounce } from '@/hooks/use-debounce'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductDto } from '@/types/retail-pos'
import { useProducts } from '../hooks/use-products'
import { productService } from '../services/product.service'

const BARCODE = /^\d{8,14}$/

export type ProductPickerHandle = { focus: () => void }

/**
 * Ô quét mã hoặc tìm tên để thêm mặt hàng vào phiếu (phiếu nhập, phiếu điều chỉnh; UC-13, UC-14, FR-34).
 * Gõ mã 8–14 số rồi Enter = quét (`GET /api/products/lookup`, trả cả đơn vị khớp mã); gõ chữ = gợi ý theo tên không dấu.
 * `listenScan`: nhận sự kiện `pos:simulate-scan` của thanh công cụ demo (07 §4.2).
 */
export const ProductPicker = forwardRef<
  ProductPickerHandle,
  {
    onPick: (product: ProductDto, unitId?: string) => void
    placeholder?: string
    listenScan?: boolean
    includeInactive?: boolean
    className?: string
    disabled?: boolean
  }
>(function ProductPicker({ onPick, placeholder = 'Quét mã vạch hoặc gõ tên hàng', listenScan, includeInactive, className, disabled }, ref) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [scanning, setScanning] = useState(false)
  const debounced = useDebounce(text.trim(), 250)
  const isCode = BARCODE.test(debounced)
  const search = useProducts(
    { search: debounced, pageSize: 12, status: includeInactive ? undefined : 'DangBan', sortBy: 'name', sortDir: 'asc' },
    open && debounced.length >= 1 && !isCode
  )
  const items = !isCode && debounced ? (search.data?.items ?? []) : []

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), [])

  const pick = (p: ProductDto, unitId?: string) => {
    onPick(p, unitId)
    setText('')
    setOpen(false)
    setActive(0)
    inputRef.current?.focus()
  }

  const lookup = async (code: string) => {
    setScanning(true)
    try {
      const found = await productService.lookup(code)
      pick(found.product, found.unitId)
    } catch (error) {
      toast.error(getErrorMessage(error, `Không tìm thấy mã vạch ${code}`))
      setText('')
    } finally {
      setScanning(false)
    }
  }

  const lookupRef = useRef(lookup)
  useEffect(() => {
    lookupRef.current = lookup
  })
  useEffect(() => {
    if (!listenScan) return
    const handler = (e: Event) => {
      const code = (e as CustomEvent<{ barcode?: string }>).detail?.barcode
      if (code) void lookupRef.current(code)
    }
    window.addEventListener('pos:simulate-scan', handler)
    return () => window.removeEventListener('pos:simulate-scan', handler)
  }, [listenScan])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const value = text.trim()
      if (BARCODE.test(value)) void lookup(value)
      else if (items[active]) pick(items[active])
    }
  }

  const showList = open && !!debounced && !isCode

  return (
    <div className={cn('relative', className)}>
      <ScanBarcode className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
      <Input
        ref={inputRef}
        value={text}
        disabled={disabled || scanning}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={placeholder}
        className="h-11 pr-9 pl-9"
      />
      {(scanning || (search.isFetching && showList)) && (
        <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" aria-hidden="true" />
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="bg-popover text-popover-foreground absolute inset-x-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border p-1 shadow-lg"
        >
          {items.length === 0 ? (
            <li className="text-muted-foreground px-3 py-2 text-sm">{search.isFetching ? 'Đang tìm…' : 'Không có mặt hàng khớp'}</li>
          ) : (
            items.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(p)
                }}
                onMouseEnter={() => setActive(i)}
                className={cn('flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5', i === active && 'bg-accent text-accent-foreground')}
              >
                <ProductImage imageUrl={p.imageUrl} color={p.color} name={p.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    <span className="font-mono">{p.code}</span> · Tồn {p.stockText} · {formatVnd(p.price)}/{p.baseUnit.toLowerCase()}
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
})
