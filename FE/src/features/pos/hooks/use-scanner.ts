'use client'

import { useEffect, useRef } from 'react'

/** Sự kiện máy quét giả lập của DemoToolbar, bảng "Mã vạch mẫu" (07 §4.2 mục 2, 3) */
export const SIMULATE_SCAN_EVENT = 'pos:simulate-scan'
export type SimulateScanDetail = { barcode: string }

/** Phát một lần quét giả lập */
export function simulateScan(barcode: string) {
  window.dispatchEvent(new CustomEvent<SimulateScanDetail>(SIMULATE_SCAN_EVENT, { detail: { barcode } }))
}

const LISTEN_EVENT = 'pos:scan-listening'
let listeners = 0

/** Có màn nào đang nghe máy quét (DemoToolbar khóa nút khi không có) */
export const isScanListening = () => listeners > 0
export function subscribeScanListening(cb: () => void) {
  window.addEventListener(LISTEN_EVENT, cb)
  return () => window.removeEventListener(LISTEN_EVENT, cb)
}

const isEditable = (el: Element | null) =>
  !!el &&
  (el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el as HTMLElement).isContentEditable)

/**
 * Nghe máy quét (07 §4.2 mục 1, 3): sự kiện `pos:simulate-scan`; khi con trỏ không ở ô nhập liệu, chuỗi
 * ≥ 8 chữ số gõ cách nhau < 50 ms kết thúc bằng Enter được coi là một lần quét.
 */
export function useScanner(onScan: (code: string) => void, enabled = true) {
  const handler = useRef(onScan)
  useEffect(() => {
    handler.current = onScan
  })

  useEffect(() => {
    if (!enabled) return
    listeners++
    window.dispatchEvent(new Event(LISTEN_EVENT))
    let buffer = ''
    let last = 0
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(document.activeElement)) {
        buffer = ''
        return
      }
      const now = performance.now()
      if (/^\d$/.test(e.key)) {
        buffer = now - last < 50 ? buffer + e.key : e.key
        last = now
      } else if (e.key === 'Enter') {
        if (buffer.length >= 8 && now - last < 50) {
          e.preventDefault()
          handler.current(buffer)
        }
        buffer = ''
      } else if (e.key.length === 1) {
        buffer = ''
      }
    }
    const onSim = (e: Event) => {
      const code = (e as CustomEvent<SimulateScanDetail>).detail?.barcode
      if (code) handler.current(code)
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener(SIMULATE_SCAN_EVENT, onSim)
    return () => {
      listeners--
      window.dispatchEvent(new Event(LISTEN_EVENT))
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener(SIMULATE_SCAN_EVENT, onSim)
    }
  }, [enabled])
}
