'use client'

import { storageKey } from '@/lib/storage'

/**
 * In qua `iframe` ẩn (07 §4.4, quyết định 30): trình duyệt chặn cửa sổ bật lên nên không mở tab mới.
 * Trang in (`?print=1`) báo `pos:print-ready` khi vẽ xong, trang cha gọi `print()` của iframe.
 * Chế độ "Xem trước bản in" (bật trong menu màn bán hàng, lưu `sessionStorage`) không gọi hộp in mà phát
 * sự kiện `pos:print-preview` để hiện bản in trên màn hình (trình diễn không có máy in).
 */

export const PRINT_PREVIEW_KEY = storageKey('print-preview')
export const PRINT_READY = 'pos:print-ready'
export const PRINT_PREVIEW_EVENT = 'pos:print-preview'
/** Yêu cầu màn quầy trả con trỏ về ô quét */
export const REFOCUS_EVENT = 'pos:refocus'

export function isPrintPreview(): boolean {
  try {
    return window.sessionStorage.getItem(PRINT_PREVIEW_KEY) === '1'
  } catch {
    return false
  }
}

export function setPrintPreview(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(PRINT_PREVIEW_KEY, '1')
    else window.sessionStorage.removeItem(PRINT_PREVIEW_KEY)
  } catch {
    // bỏ qua
  }
}

/** In một trang bản in (đường dẫn trong app) */
export function printUrl(path: string) {
  if (typeof window === 'undefined') return
  if (isPrintPreview()) {
    window.dispatchEvent(new CustomEvent(PRINT_PREVIEW_EVENT, { detail: { url: path } }))
    return
  }
  const url = path.includes('?') ? `${path}&print=1` : `${path}?print=1`
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  const onMessage = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow || event.data !== PRINT_READY) return
    window.removeEventListener('message', onMessage)
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } finally {
      setTimeout(() => frame.remove(), 60_000)
    }
  }
  window.addEventListener('message', onMessage)
  frame.src = url
  document.body.appendChild(frame)
}

/** Gọi ở trang bản in khi đã vẽ xong và có `?print=1`: trong iframe báo trang cha, mở trực tiếp thì tự in */
export function signalPrintReady() {
  if (window.parent && window.parent !== window) window.parent.postMessage(PRINT_READY, window.location.origin)
  else window.print()
}
