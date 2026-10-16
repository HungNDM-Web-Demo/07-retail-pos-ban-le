'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ShoppingBasket, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { posRules } from '@/config/pos-rules'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { QuoteLine } from '@/types/retail-pos'
import type { CatalogIndex } from '../lib/cart'
import { overStockText } from '../lib/stock-math'
import type { CartLine } from '../stores/held-tabs.store'
import { ProductImage } from './ProductImage'

export type CartRow = { line: CartLine; priced?: QuoteLine; shortage: number }

type CartTableProps = {
  rows: CartRow[]
  index: CatalogIndex
  selectedKey?: string
  disabled?: boolean
  onSelect: (key: string) => void
  onQuantity: (key: string, quantity: number) => void
  onUnit: (key: string, unitId: string) => void
  onRemove: (key: string) => void
  /** Trả con trỏ về ô quét */
  onDone: () => void
}

/**
 * Bảng giỏ (SCR-02): STT, tên, đơn vị (chọn), số lượng sửa được, đơn giá, giảm, thành tiền, xóa.
 * Dòng vượt tồn nền cam kèm "Vượt tồn {n} {đơn vị}" (BR-10, TC-19). Dòng chọn bằng mũi tên lên/xuống.
 */
export function CartTable({ rows, index, selectedKey, disabled, onSelect, onQuantity, onUnit, onRemove, onDone }: CartTableProps) {
  const selectedRef = useRef<HTMLTableRowElement>(null)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedKey, rows.length])

  if (!rows.length) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <ShoppingBasket className="size-12 opacity-40" aria-hidden="true" />
        <p className="text-base font-medium">Hóa đơn chưa có hàng</p>
        <p className="max-w-sm text-sm">Quét mã vạch, gõ tên hàng (F2) hoặc bấm &quot;Mã vạch mẫu&quot; trên thanh trên.</p>
      </div>
    )
  }

  return (
    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
      <colgroup>
        <col className="w-10" />
        <col />
        <col className="w-32" />
        <col className="w-24" />
        <col className="w-28" />
        <col className="w-24" />
        <col className="w-32" />
        <col className="w-12" />
      </colgroup>
      <thead className="bg-muted/70 text-muted-foreground sticky top-0 z-10 text-xs font-semibold uppercase">
        <tr>
          <th className="px-2 py-2 text-center">#</th>
          <th className="px-2 py-2 text-left">Hàng hóa</th>
          <th className="px-2 py-2 text-left">Đơn vị</th>
          <th className="px-2 py-2 text-right">SL</th>
          <th className="px-2 py-2 text-right">Đơn giá</th>
          <th className="px-2 py-2 text-right">Giảm</th>
          <th className="px-2 py-2 text-right">Thành tiền</th>
          <th className="px-1 py-2">
            <span className="sr-only">Xóa</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ line, priced, shortage }, i) => {
          const item = index.byProduct.get(line.productId)
          const selected = line.key === selectedKey
          return (
            <tr
              key={line.key}
              ref={selected ? selectedRef : undefined}
              onClick={() => onSelect(line.key)}
              aria-selected={selected}
              className={cn(
                'cursor-pointer transition-colors [&>td]:border-b [&>td]:px-2 [&>td]:py-2',
                selected ? 'bg-primary/10 [&>td:first-child]:shadow-[inset_3px_0_0_var(--primary)]' : 'hover:bg-muted/50',
                // Dòng vượt tồn luôn nền cam, kể cả khi đang chọn (07 §4.3)
                shortage > 0 && (selected ? 'bg-warning/20' : 'bg-warning/10')
              )}
            >
              <td className="text-muted-foreground text-center tabular-nums">{i + 1}</td>
              <td>
                <div className="flex min-w-0 items-center gap-2.5">
                  <ProductImage name={item?.name ?? '?'} imageUrl={item?.imageUrl} color={item?.color} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-[0.9375rem] leading-tight font-semibold" title={item?.name}>
                      {item?.name ?? 'Hàng không còn trong danh mục'}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {item?.code}
                      {line.discount?.reason && ' · giảm dòng'}
                    </p>
                    {shortage > 0 && item && (
                      <p className="text-warning flex items-center gap-1 text-xs font-semibold">
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        {overStockText(shortage, item.baseUnit)}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td>
                <select
                  aria-label={`Đơn vị dòng ${i + 1}`}
                  value={line.unitId}
                  disabled={disabled}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    onUnit(line.key, e.target.value)
                    onDone()
                  }}
                  className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-2 text-sm focus-visible:ring-3 focus-visible:outline-none"
                >
                  {item?.units.map((u) => (
                    <option key={u.unitId} value={u.unitId}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <QuantityInput
                  value={line.quantity}
                  disabled={disabled}
                  label={`Số lượng dòng ${i + 1}`}
                  onCommit={(q) => onQuantity(line.key, q)}
                  onDone={onDone}
                />
              </td>
              <td className="text-right tabular-nums">{formatNumber(priced?.unitPrice ?? 0, 0)}</td>
              <td className="text-destructive text-right tabular-nums">
                {priced?.discountAmount ? `−${formatNumber(priced.discountAmount, 0)}` : ''}
              </td>
              <td className="text-right text-base font-semibold tabular-nums">
                {formatVnd((priced?.amount ?? 0) - (priced?.discountAmount ?? 0))}
              </td>
              <td className="text-center">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  aria-label={`Xóa dòng ${i + 1}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(line.key)
                    onDone()
                  }}
                >
                  <Trash2 />
                </Button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function QuantityInput({
  value,
  disabled,
  label,
  onCommit,
  onDone,
}: {
  value: number
  disabled?: boolean
  label: string
  onCommit: (q: number) => void
  onDone: () => void
}) {
  const [text, setText] = useState<string | null>(null)
  const commit = () => {
    if (text === null) return
    const q = Number(text)
    if (Number.isInteger(q) && q >= 1 && q <= posRules.maxLineQuantity) onCommit(q)
    setText(null)
  }
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      disabled={disabled}
      value={text ?? String(value)}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 4))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          onDone()
        } else if (e.key === 'Escape') {
          setText(null)
          onDone()
        }
      }}
      className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-2 text-right text-base font-semibold tabular-nums focus-visible:ring-3 focus-visible:outline-none"
    />
  )
}
