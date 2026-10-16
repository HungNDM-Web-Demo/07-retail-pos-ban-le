import { posRules } from '@/config/pos-rules'

/**
 * Mã vạch và chuỗi quét (07 §3.10; BE `Domain/Entities/Pos/Barcodes.cs`).
 */

/** Số kiểm tra EAN-13 của 12 số đầu */
export function ean13CheckDigit(d12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = Number(d12[i])
    sum += (i % 2 === 0 ? 1 : 3) * digit // vị trí lẻ (1, 3, …) hệ số 1
  }
  return (10 - (sum % 10)) % 10
}

/** Mã 13 chữ số có số kiểm tra EAN-13 đúng */
export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12])
}

/** Mã vạch hợp lệ khi lưu: 8–14 chữ số (BR-03) */
export const isBarcodeFormat = (code: string): boolean => /^\d{8,14}$/.test(code)

const INTERNAL = new RegExp('^' + posRules.internalBarcodePrefix + '(\\d{10})\\d$')

/**
 * Mã nội bộ kế tiếp (BR-03): "20" + (số thứ tự lớn nhất trong các mã "20" + 10 số + 1 số, cộng 1) + số kiểm tra.
 * Dữ liệu mẫu đã dùng 1–36 → "2000000000374".
 */
export function nextInternalBarcode(existing: Iterable<string | null | undefined>): string {
  let max = 0
  for (const code of existing) {
    const m = code ? INTERNAL.exec(code) : null
    if (m) max = Math.max(max, Number(m[1]))
  }
  const d12 = `${posRules.internalBarcodePrefix}${String(max + 1).padStart(10, '0')}`
  return `${d12}${ean13CheckDigit(d12)}`
}

export type ScanInput = {
  /** Tiền tố n* hợp lệ (1–999), áp cho lần thêm kế tiếp */
  prefixQty?: number
  /** Chuỗi toàn chữ số 8–14 → tra mã vạch */
  code?: string
  /** Còn lại → mở gợi ý tìm tên */
  search?: string
  /** Tiền tố sai */
  error?: string
}

export const SCAN_PREFIX_ERROR = `Số lượng trước dấu * từ 1 đến ${posRules.maxScanPrefix}`

/**
 * Phân tích chuỗi gõ vào ô quét rồi Enter (FR-08, FR-09). `12*` → tiền tố 12; `12*8939…` → tiền tố + mã;
 * tiền tố 0, > 999, có chữ → `error` và bỏ tiền tố (phần sau * vẫn xử lý). Mã đầu 21–29 không giải mã
 * (quyết định 1).
 */
export function parseScanInput(text: string): ScanInput {
  const value = text.trim()
  const result: ScanInput = {}
  let rest = value
  const star = /^([^*\s]{1,8})\*(.*)$/.exec(value)
  if (star) {
    const [, prefix, after] = star
    const n = /^\d{1,4}$/.test(prefix) ? Number(prefix) : NaN
    if (Number.isInteger(n) && n >= 1 && n <= posRules.maxScanPrefix) result.prefixQty = n
    else result.error = SCAN_PREFIX_ERROR
    rest = after.trim()
  }
  if (!rest) return result
  if (/^\d{8,14}$/.test(rest)) result.code = rest
  else result.search = rest
  return result
}
