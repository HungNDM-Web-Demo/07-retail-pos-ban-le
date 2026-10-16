import { formatVnd } from '@/lib/format'

/** Tiền có dấu: số âm dùng dấu trừ U+2212 (07 §4.6), vd "−23.500 ₫" */
export const formatSignedVnd = (value: number | null | undefined): string => formatVnd(value).replace('-', '−')
