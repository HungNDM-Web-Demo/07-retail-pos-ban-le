/**
 * Giờ Việt Nam (UTC+7, không đổi giờ mùa hè) cho ngày lịch, mã chứng từ, ca, thời hạn đổi trả, báo cáo
 * (06 §3; BE `VietnamTime`). Không phụ thuộc múi giờ của máy. Chép từ demo 03/04, thêm hàm 07 §4.9.
 */

const OFFSET_MS = 7 * 60 * 60_000
const DAY_MS = 86_400_000

type DateInput = Date | number | string

export type VnParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  isoWeekday: number
}

/** Thời điểm hiện tại (ms). Một chỗ để mock và giao diện dùng chung. */
export const vnNow = (): number => Date.now()

/** Tách ngày giờ Việt Nam của một thời điểm */
export function vnParts(date: DateInput): VnParts {
  const d = new Date(new Date(date).getTime() + OFFSET_MS)
  const weekday = d.getUTCDay() // 0 = CN
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    isoWeekday: weekday === 0 ? 7 : weekday,
  }
}

/** Khóa ngày "yyyy-MM-dd" theo giờ Việt Nam */
export function vnDateKey(date: DateInput): string {
  const p = vnParts(date)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Khóa ngày hôm nay (giờ Việt Nam) */
export const vnTodayKey = (): string => vnDateKey(vnNow())

/** "yyMMdd" theo giờ Việt Nam (mã HD, TH, PN, DC, CA) */
export function vnYyMMdd(date: DateInput): string {
  return vnDateKey(date).slice(2).replace(/-/g, '')
}

/** Thời điểm UTC (ms) của 00:00 ngày "yyyy-MM-dd" giờ Việt Nam */
export function vnStartOfDay(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return Date.UTC(y, m - 1, d) - OFFSET_MS
}

/** Thời điểm (ms) của "HH:mm" giờ Việt Nam ngày dateKey */
export function vnAt(dateKey: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return vnStartOfDay(dateKey) + (h * 60 + (m || 0)) * 60_000
}

/** Cộng n ngày vào khóa ngày */
export function addDaysKey(dateKey: string, days: number): string {
  return vnDateKey(vnStartOfDay(dateKey) + days * DAY_MS + 12 * 3600_000)
}

/** Số ngày giữa hai khóa ngày (to − from) */
export function diffDaysKey(from: string, to: string): number {
  return Math.round((vnStartOfDay(to) - vnStartOfDay(from)) / DAY_MS)
}

/**
 * ISO UTC của (hôm nay + dayOffset) lúc "HH:mm" giờ Việt Nam (06 §5.2: `d`, `t` trong seed).
 * `time` vắng thì lấy 00:00.
 */
export function vnDateTime(dayOffset: number, time = '00:00', todayKey: string = vnTodayKey()): string {
  return new Date(vnAt(addDaysKey(todayKey, dayOffset), time)).toISOString()
}

/** "HH:mm" giờ Việt Nam */
export function vnHhmm(date: DateInput): string {
  const p = vnParts(date)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/** Phút trong ngày (giờ Việt Nam), 0–1439 */
export function vnMinutesOfDay(date: DateInput): number {
  const p = vnParts(date)
  return p.hour * 60 + p.minute
}

/** Số ngày lịch (giờ Việt Nam) từ ngày của `fromIso` tới ngày của `toIso` (BR-17: ngày mua là 0) */
export function daysBetweenVn(fromIso: DateInput, toIso: DateInput = vnNow()): number {
  return diffDaysKey(vnDateKey(fromIso), vnDateKey(toIso))
}

/**
 * Khoảng thời gian (ms, gồm cả hai đầu) của tham số `from`, `to` dạng "yyyy-MM-dd" giờ Việt Nam:
 * 00:00 `from` tới 23:59:59.999 `to`. Đầu nào vắng thì mở.
 */
export function vnDayRange(from?: string | null, to?: string | null): { start: number; end: number } {
  return {
    start: from ? vnStartOfDay(from) : Number.NEGATIVE_INFINITY,
    end: to ? vnStartOfDay(to) + DAY_MS - 1 : Number.POSITIVE_INFINITY,
  }
}

/** Thời điểm có nằm trong khoảng ngày (giờ Việt Nam) không */
export function inVnRange(iso: DateInput | null | undefined, from?: string | null, to?: string | null): boolean {
  if (!from && !to) return true
  if (iso === null || iso === undefined) return false
  const t = new Date(iso).getTime()
  const { start, end } = vnDayRange(from, to)
  return t >= start && t <= end
}

/** "dd/MM/yyyy HH:mm" giờ Việt Nam (bản in) */
export function vnFormatDateTime(date: DateInput): string {
  const p = vnParts(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour)}:${pad(p.minute)}`
}
