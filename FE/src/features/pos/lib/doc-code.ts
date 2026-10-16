/**
 * Mã chứng từ (SRS §5.3, 07 §3.10): tiền tố + yyMMdd (giờ Việt Nam) + số thứ tự trong ngày.
 * Số thứ tự = số lớn nhất đã có cùng tiền tố cùng ngày + 1. Vd nextDocCode('HD', 4, '2026-10-15', codes)
 * → "HD2610150056".
 */
export function nextDocCode(
  prefix: string,
  digits: number,
  dayKey: string,
  existingCodes: Iterable<string>
): string {
  const head = `${prefix}${dayKey.slice(2).replace(/-/g, '')}`
  let max = 0
  for (const code of existingCodes) {
    if (!code.startsWith(head) || code.length !== head.length + digits) continue
    const n = Number(code.slice(head.length))
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${head}${String(max + 1).padStart(digits, '0')}`
}

/** Mã chứng từ có số thứ tự cho trước (nạp seed) */
export const docCode = (prefix: string, digits: number, dayKey: string, seq: number): string =>
  `${prefix}${dayKey.slice(2).replace(/-/g, '')}${String(seq).padStart(digits, '0')}`
