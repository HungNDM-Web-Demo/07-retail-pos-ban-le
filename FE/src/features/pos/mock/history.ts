import { mockDb } from '@/mock/mock-db'
import type { GoodsReceiptRecord, OrderRecord, StockAdjustmentRecord } from '@/types/retail-pos'
import { buildSeed, type SeedResult } from './seed-data'

/**
 * Kho chỉ đọc trong bộ nhớ (07 §4.8): hóa đơn trước hôm nay (~5.000), phiếu nhập đã nhập kho mẫu (38),
 * phiếu điều chỉnh mẫu (12). Dựng lại từ seed mỗi lần tải trang, **không** ghi localStorage. Không thao tác
 * nào sửa các bản ghi này (trạng thái trả hàng suy ra từ collection `returns` lúc đọc): nơi gọi không được sửa
 * mảng hay bản ghi trả về.
 *
 * Cùng một lần dựng seed còn cấp dữ liệu ban đầu cho các collection ở `pos.db.ts`, để hai nguồn luôn khớp.
 */

let cache: SeedResult | null = null

/** Kết quả dựng seed của lần tải trang này (dựng lười, dựng lại sau "Đặt lại dữ liệu") */
export function seedSnapshot(): SeedResult {
  if (!cache) cache = buildSeed()
  return cache
}

/** Bỏ kết quả đã dựng (đặt lại dữ liệu, sang ngày mới) */
export function clearSeedSnapshot() {
  cache = null
}

mockDb.onReset(clearSeedSnapshot)

export const historyOrders = (): readonly OrderRecord[] => seedSnapshot().historyOrders
export const historyReceipts = (): readonly GoodsReceiptRecord[] => seedSnapshot().historyReceipts
export const historyAdjustments = (): readonly StockAdjustmentRecord[] => seedSnapshot().historyAdjustments
