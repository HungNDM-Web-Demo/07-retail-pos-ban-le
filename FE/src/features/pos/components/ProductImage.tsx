'use client'

import { useState } from 'react'
import { useAssetUrl } from '@/hooks/use-asset-url'
import { cn } from '@/lib/utils'

type ProductImageProps = {
  name: string
  imageUrl?: string | null
  /** Màu nền ô (hex của hàng hóa); ảnh bao bì nền trong suốt nằm trên */
  color?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  xs: 'size-8 rounded-md text-[10px]',
  sm: 'size-10 rounded-md text-xs',
  md: 'size-14 rounded-lg text-sm',
  lg: 'size-24 rounded-xl text-lg',
} as const

/** Hai chữ cái đầu của tên (bỏ số): "Bia lager lon" → "BL" */
function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^\p{L}/u.test(w))
  return (words[0]?.[0] ?? '?').concat(words[1]?.[0] ?? '').toUpperCase()
}

/**
 * Ô ảnh hàng hóa (06 §3 "Ảnh hàng hóa"): nền `color` của hàng, ảnh kiểu bao bì `/seed/products/{kiểu}.webp`
 * (hoặc ảnh tải lên `idb://`) đặt trên; thiếu ảnh hoặc lỗi tải thì hiện 2 chữ cái đầu tên.
 */
export function ProductImage({ name, imageUrl, color, size = 'sm', className }: ProductImageProps) {
  const src = useAssetUrl(imageUrl)
  const [failed, setFailed] = useState<string | null>(null)
  const showImage = !!src && failed !== src
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold text-white ring-1 ring-black/5 ring-inset select-none',
        SIZES[size],
        className
      )}
      style={{ backgroundColor: color || 'var(--muted-foreground)' }}
      aria-hidden="true"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh nhỏ, có thể là blob URL
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-contain p-[8%] drop-shadow-sm"
          onError={() => setFailed(src)}
        />
      ) : (
        <span className="drop-shadow-sm">{initials(name)}</span>
      )}
    </span>
  )
}
