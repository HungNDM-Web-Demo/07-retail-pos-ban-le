'use client'

import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { cn } from '@/lib/utils'
import { isValidEan13 } from '../lib/barcode'

type BarcodeSvgProps = {
  value: string
  /** Mặc định CODE128; EAN13 chỉ khi mã 13 số đúng số kiểm tra (không thì tự về CODE128) */
  format?: 'CODE128' | 'EAN13'
  /** Chiều cao vạch (px) */
  height?: number
  /** Độ rộng một vạch nhỏ nhất (px) */
  width?: number
  displayValue?: boolean
  fontSize?: number
  className?: string
}

/**
 * Vẽ mã vạch SVG bằng `jsbarcode` (07 §4.4, quyết định 30): Code 128 mã hóa đơn trên bill, EAN-13 trên tem.
 * Màu đen trên nền trắng để máy quét đọc được ở cả giao diện tối.
 */
export function BarcodeSvg({
  value,
  format = 'CODE128',
  height = 40,
  width = 1.4,
  displayValue = true,
  fontSize = 12,
  className,
}: BarcodeSvgProps) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || !value) return
    const useFormat = format === 'EAN13' && isValidEan13(value) ? 'EAN13' : 'CODE128'
    try {
      JsBarcode(ref.current, value, {
        format: useFormat,
        height,
        width,
        displayValue,
        fontSize,
        margin: 0,
        textMargin: 2,
        background: '#ffffff',
        lineColor: '#000000',
        font: 'monospace',
      })
    } catch {
      // Mã không hợp lệ: để trống
    }
  }, [value, format, height, width, displayValue, fontSize])
  return <svg ref={ref} className={cn('max-w-full', className)} role="img" aria-label={`Mã vạch ${value}`} />
}
