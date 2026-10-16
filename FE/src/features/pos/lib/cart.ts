import { posRules } from '@/config/pos-rules'
import { normalizeVi } from '@/lib/normalize'
import type { PosCatalog, PosCatalogItem, PosCatalogUnit } from '@/types/retail-pos'
import type { PricingUnit, UnitLookup } from './pricing'
import type { CartLine, HeldTab } from '../stores/held-tabs.store'

/**
 * Giỏ tại máy bán hàng (07 §3.3, §3.10, §4.3): chỉ mục danh mục, tìm không dấu, thêm dòng, gộp dòng.
 * Chạy hoàn toàn trên danh mục `['pos-catalog']`, không gọi API (NFR-02).
 */

export type CatalogHit = { item: PosCatalogItem; unit: PosCatalogUnit }

export type CatalogIndex = {
  byBarcode: Map<string, CatalogHit>
  byProduct: Map<string, PosCatalogItem>
  lookup: UnitLookup
}

export function buildCatalogIndex(catalog: PosCatalog | undefined): CatalogIndex {
  const byBarcode = new Map<string, CatalogHit>()
  const byProduct = new Map<string, PosCatalogItem>()
  for (const item of catalog?.items ?? []) {
    byProduct.set(item.productId, item)
    for (const unit of item.units) if (unit.barcode) byBarcode.set(unit.barcode, { item, unit })
  }
  const lookup: UnitLookup = (productId, unitId): PricingUnit | undefined => {
    const item = byProduct.get(productId)
    const unit = item?.units.find((u) => u.unitId === unitId)
    return item && unit
      ? { productName: item.name, unitName: unit.name, factor: unit.factor, price: unit.price }
      : undefined
  }
  return { byBarcode, byProduct, lookup }
}

/**
 * Tìm tên (FR-10, §3.10): mọi từ của truy vấn (bỏ dấu) nằm trong `searchText`; mỗi kết quả là một đơn vị,
 * hàng đang bán trước, tối đa 20 dòng.
 */
export function searchCatalog(catalog: PosCatalog | undefined, query: string, limit = 20): CatalogHit[] {
  const words = normalizeVi(query).split(' ').filter(Boolean)
  if (!words.length || !catalog) return []
  const items = catalog.items.filter((i) => words.every((w) => i.searchText.includes(w)))
  items.sort((a, b) => (a.status === b.status ? 0 : a.status === 'DangBan' ? -1 : 1))
  const hits: CatalogHit[] = []
  for (const item of items) {
    for (const unit of item.units) {
      hits.push({ item, unit })
      if (hits.length >= limit) return hits
    }
  }
  return hits
}

const rid = () => Math.random().toString(36).slice(2, 10)

/**
 * Thêm hàng vào tab (§3.3): cùng mặt hàng, cùng đơn vị, dòng chưa có giảm dòng → cộng số lượng;
 * không thì thêm dòng mới. Trả tab mới và khóa dòng vừa thêm/cộng.
 */
export function addToTab(
  tab: HeldTab,
  productId: string,
  unitId: string,
  quantity: number
): { tab: HeldTab; key: string } {
  const existing = tab.lines.find((l) => l.productId === productId && l.unitId === unitId && !l.discount)
  if (existing) {
    const q = Math.min(posRules.maxLineQuantity, existing.quantity + quantity)
    return {
      tab: { ...tab, lines: tab.lines.map((l) => (l.key === existing.key ? { ...l, quantity: q } : l)) },
      key: existing.key,
    }
  }
  const line: CartLine = { key: rid(), productId, unitId, quantity: Math.min(posRules.maxLineQuantity, quantity) }
  return { tab: { ...tab, lines: [...tab.lines, line] }, key: line.key }
}

/** Tổng số lượng cơ bản cần của từng mặt hàng trong giỏ (BR-10) */
export function baseQtyByProduct(lines: { productId: string; unitId: string; quantity: number }[], index: CatalogIndex) {
  const map = new Map<string, number>()
  for (const l of lines) {
    const u = index.lookup(l.productId, l.unitId)
    if (u) map.set(l.productId, (map.get(l.productId) ?? 0) + l.quantity * u.factor)
  }
  return map
}

/** Phần vượt tồn (đơn vị cơ bản) của mặt hàng; 0 khi đủ */
export function shortageOf(productId: string, need: Map<string, number>, index: CatalogIndex): number {
  const item = index.byProduct.get(productId)
  if (!item) return 0
  return Math.max(0, (need.get(productId) ?? 0) - Math.max(item.stock, 0))
}
