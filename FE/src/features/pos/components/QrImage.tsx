'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type QrImageProps = {
  value: string
  size?: number
  className?: string
  alt?: string
}

/** Vẽ mã QR tại máy bằng gói `qrcode` (không gọi dịch vụ ngoài). Chép từ demo 02. */
export function QrImage({ value, size = 220, className, alt = 'Mã QR chuyển khoản' }: QrImageProps) {
  const key = `${size}:${value}`
  const [rendered, setRendered] = useState<{ key: string; url: string | null } | null>(null)
  const src = rendered?.key === key ? rendered.url : null

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setRendered({ key: `${size}:${value}`, url })
      })
      .catch(() => {
        if (!cancelled) setRendered({ key: `${size}:${value}`, url: null })
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!src) return <Skeleton className={cn('rounded-md', className)} style={{ width: size, height: size }} />
  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URL sinh tại máy
    <img src={src} alt={alt} width={size} height={size} className={cn('rounded-md bg-white', className)} />
  )
}
