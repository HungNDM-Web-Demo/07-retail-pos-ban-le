'use client'

import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PRINT_PREVIEW_EVENT, printUrl, REFOCUS_EVENT, setPrintPreview } from '../lib/print'

/**
 * Hiện bản in trên màn hình khi bật "Xem trước bản in" (trình diễn không có máy in): nghe `pos:print-preview`
 * do `printUrl` phát, mở trang in trong khung. Nhiều bản in liên tiếp thì xem lần lượt.
 */
export function PrintPreviewHost() {
  const [queue, setQueue] = useState<string[]>([])
  useEffect(() => {
    const onPreview = (e: Event) => {
      const url = (e as CustomEvent<{ url: string }>).detail?.url
      if (url) setQueue((q) => [...q, url])
    }
    window.addEventListener(PRINT_PREVIEW_EVENT, onPreview)
    return () => window.removeEventListener(PRINT_PREVIEW_EVENT, onPreview)
  }, [])
  const current = queue[0]
  return (
    <Dialog open={!!current} onOpenChange={(open) => !open && setQueue((q) => q.slice(1))}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          // Không để khung bản in giữ con trỏ (Esc, phím tắt vẫn chạy ở trang)
          e.preventDefault()
          ;(e.currentTarget as HTMLElement | null)?.focus()
        }}
        onCloseAutoFocus={(e) => {
          // Trả con trỏ về ô quét của màn quầy
          e.preventDefault()
          window.dispatchEvent(new Event(REFOCUS_EVENT))
        }}
      >
        <DialogHeader>
          <DialogTitle>Xem trước bản in</DialogTitle>
          <DialogDescription>Đang bật chế độ xem trước nên không gửi tới máy in.</DialogDescription>
        </DialogHeader>
        {current && (
          <iframe
            key={current}
            src={current}
            title="Bản in"
            tabIndex={-1}
            className="h-[60vh] w-full rounded-md border bg-white"
          />
        )}
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              if (!current) return
              setPrintPreview(false)
              printUrl(current)
              setPrintPreview(true)
            }}
          >
            <Printer aria-hidden="true" /> In bản này
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
