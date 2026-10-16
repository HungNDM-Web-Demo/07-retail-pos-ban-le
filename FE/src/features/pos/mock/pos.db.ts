import demoData from '@/mock/seed/demo-data.json'
import { readJson, storageKey, writeJson } from '@/lib/storage'
import { mockDb, type ChangeEvent } from '@/mock/mock-db'
import { settingsDb, userIdOf as systemUserIdOf } from '@/mock/system-data'
import type {
  CustomerRecord,
  GoodsReceiptRecord,
  OrderRecord,
  ProductGroupRecord,
  ProductRecord,
  ProductUnitRecord,
  ReturnRecord,
  ShiftRecord,
  StockAdjustmentRecord,
  SupplierRecord,
} from '@/types/retail-pos'
import { vnTodayKey } from '../lib/vn-time'
import { clearSeedSnapshot, historyAdjustments, historyOrders, historyReceipts, seedSnapshot } from './history'

/**
 * Mock-db của dự án (07 §4.8): **mọi** collection nghiệp vụ khai báo, nạp seed tại đây (scope `business`,
 * xóa khi "Đặt lại dữ liệu"). FE-Quản lý chỉ đọc, ghi qua `posDb.*` và các hàm dưới, không tự khai báo.
 *
 * - `orders` chỉ giữ hóa đơn hôm nay đã nạp + tạo trong phiên; lịch sử trước hôm nay ở `history.ts`.
 *   Đọc mọi hóa đơn bằng `allOrders()` (tương tự `allReceipts()`, `allAdjustments()`).
 * - `receipts` chỉ giữ phiếu nháp mẫu + phiếu tạo trong phiên; `adjustments` chỉ phiếu tạo trong phiên.
 * - Mọi collection được nạp cùng một lần (cùng giờ nạp) để tồn hàng khớp hóa đơn hôm nay (06 §5.3).
 *   Mở demo sang ngày khác so với lần nạp trước → nạp lại toàn bộ dữ liệu nghiệp vụ theo hôm nay.
 */

mockDb.registerSeed('demo-data', demoData)

const raw = {
  groups: mockDb.collection<ProductGroupRecord>('product-groups', () => seedSnapshot().groups),
  products: mockDb.collection<ProductRecord>('products', () => seedSnapshot().products),
  suppliers: mockDb.collection<SupplierRecord>('suppliers', () => seedSnapshot().suppliers),
  receipts: mockDb.collection<GoodsReceiptRecord>('goods-receipts', () => seedSnapshot().draftReceipts),
  adjustments: mockDb.collection<StockAdjustmentRecord>('stock-adjustments', () => []),
  shifts: mockDb.collection<ShiftRecord>('shifts', () => seedSnapshot().shifts),
  orders: mockDb.collection<OrderRecord>('orders', () => seedSnapshot().todayOrders),
  returns: mockDb.collection<ReturnRecord>('returns', () => seedSnapshot().returns),
  customers: mockDb.collection<CustomerRecord>('customers', () => seedSnapshot().customers),
}

type PosCollections = typeof raw
const SEED_DAY_KEY = storageKey('pos-seed-day')
let ensured = false

/** Nạp mọi collection cùng lúc; sang ngày mới thì nạp lại theo hôm nay. */
function ensureSeeded() {
  if (ensured || typeof window === 'undefined') return
  ensured = true
  const today = vnTodayKey()
  const seededDay = readJson<string>('local', SEED_DAY_KEY)
  mockDb.batch(() => {
    if (seededDay && seededDay !== today) {
      clearSeedSnapshot()
      Object.values(raw).forEach((c) => c.reseed())
    }
    Object.values(raw).forEach((c) => c.count())
  })
  writeJson('local', SEED_DAY_KEY, today)
}

mockDb.onReset(() => {
  ensured = false
})

/** Collection nghiệp vụ. Truy cập lần đầu nạp seed của mọi collection cùng lúc. */
export const posDb: PosCollections = {
  get groups() {
    ensureSeeded()
    return raw.groups
  },
  get products() {
    ensureSeeded()
    return raw.products
  },
  get suppliers() {
    ensureSeeded()
    return raw.suppliers
  },
  get receipts() {
    ensureSeeded()
    return raw.receipts
  },
  get adjustments() {
    ensureSeeded()
    return raw.adjustments
  },
  get shifts() {
    ensureSeeded()
    return raw.shifts
  },
  get orders() {
    ensureSeeded()
    return raw.orders
  },
  get returns() {
    ensureSeeded()
    return raw.returns
  },
  get customers() {
    ensureSeeded()
    return raw.customers
  },
}

// ───────────────────────── Bộ nhớ đệm làm mới theo thay đổi mock-db ─────────────────────────

const caches = new Set<{ deps: string[]; clear: () => void }>()
let subscribed = false

function subscribeOnce() {
  if (subscribed || typeof window === 'undefined') return
  subscribed = true
  mockDb.subscribe((event: ChangeEvent) => {
    caches.forEach((c) => {
      if (event.reset || event.collections.length === 0 || event.collections.some((n) => c.deps.includes(n))) {
        c.clear()
      }
    })
  })
}
mockDb.onReset(() => caches.forEach((c) => c.clear()))

/**
 * Giá trị tính từ collection, tính lại khi một trong `deps` (tên collection) đổi ở tab này hoặc tab khác.
 * Dùng cho chỉ mục nặng (mã vạch → đơn vị, dòng hóa đơn → số đã trả…). Không sửa giá trị trả về.
 */
export function memoOnChange<T>(deps: (keyof PosCollections)[], compute: () => T): () => T {
  const names = deps.map((d) => raw[d].name)
  let value: { v: T } | null = null
  caches.add({ deps: names, clear: () => (value = null) })
  return () => {
    subscribeOnce()
    if (!value) value = { v: compute() }
    return value.v
  }
}

// ───────────────────────── Hợp hai nguồn ─────────────────────────

/** Mọi hóa đơn: lịch sử trước hôm nay + collection `orders`. Không sửa mảng trả về. */
export const allOrders = memoOnChange(['orders'], (): readonly OrderRecord[] => [
  ...historyOrders(),
  ...posDb.orders.all(),
])
/** Mọi phiếu nhập: đã nhập kho mẫu + collection `receipts` (nháp mẫu, tạo trong phiên) */
export const allReceipts = memoOnChange(['receipts'], (): readonly GoodsReceiptRecord[] => [
  ...historyReceipts(),
  ...posDb.receipts.all(),
])
/** Mọi phiếu điều chỉnh: mẫu + tạo trong phiên */
export const allAdjustments = memoOnChange(['adjustments'], (): readonly StockAdjustmentRecord[] => [
  ...historyAdjustments(),
  ...posDb.adjustments.all(),
])
/** Mọi phiếu đổi trả (đều nằm trong collection `returns`) */
export const allReturns = memoOnChange(['returns'], (): readonly ReturnRecord[] => posDb.returns.all())

// ───────────────────────── Tra cứu ─────────────────────────

const productIndex = memoOnChange(['products'], () => {
  const byId = new Map<string, ProductRecord>()
  const byBarcode = new Map<string, { product: ProductRecord; unit: ProductUnitRecord }>()
  for (const p of posDb.products.all()) {
    byId.set(p.id, p)
    for (const u of p.units) if (u.barcode) byBarcode.set(u.barcode, { product: p, unit: u })
  }
  return { byId, byBarcode }
})

/** Mặt hàng theo id (bản đệm, không sửa; ghi bằng `posDb.products.update`) */
export const productById = (id: string): ProductRecord | undefined => productIndex().byId.get(id)

/** Mặt hàng và đơn vị khớp mã vạch (mọi đơn vị, kể cả hàng ngừng bán) */
export const unitByBarcode = (code: string) => productIndex().byBarcode.get(code)

const groupIndex = memoOnChange(['groups'], () => new Map(posDb.groups.all().map((g) => [g.id, g])))
export const groupById = (id: string): ProductGroupRecord | undefined => groupIndex().get(id)

const supplierIndex = memoOnChange(['suppliers'], () => new Map(posDb.suppliers.all().map((s) => [s.id, s])))
export const supplierById = (id: string): SupplierRecord | undefined => supplierIndex().get(id)

const shiftIndex = memoOnChange(['shifts'], () => new Map(posDb.shifts.all().map((s) => [s.id, s])))
export const shiftById = (id: string): ShiftRecord | undefined => shiftIndex().get(id)

const orderIndex = memoOnChange(['orders'], () => new Map(allOrders().map((o) => [o.id, o])))
export const orderById = (id: string): OrderRecord | undefined => orderIndex().get(id)

const customerIndex = memoOnChange(['customers'], () => new Map(posDb.customers.all().map((c) => [c.id, c])))
export const customerById = (id: string): CustomerRecord | undefined => customerIndex().get(id)

/** Id tài khoản theo tên đăng nhập (`stableId('user', username)`, như nền) */
export const userIdOf = (username: string): string => systemUserIdOf(username)

/** Giá trị cài đặt (`settingsDb` của nền) */
export function settingValue(key: string): string | undefined {
  return settingsDb.find((s) => s.key === key)?.value
}
