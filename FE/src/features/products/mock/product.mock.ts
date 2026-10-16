import { permissions } from '@/config/permissions'
import { posRules } from '@/config/pos-rules'
import { isBarcodeFormat, nextInternalBarcode } from '@/features/pos/lib/barcode'
import { canViewCost } from '@/features/pos/mock/catalog.mock'
import { productHasDocuments, isUnitUsed, toProductDto } from '@/features/pos/mock/mappers'
import { groupById, posDb, productById, unitByBarcode } from '@/features/pos/mock/pos.db'
import { fieldError, posError } from '@/features/pos/mock/pos.errors'
import { mockDelay } from '@/lib/data-source'
import { normalizeVi } from '@/lib/normalize'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { conflict, notFound } from '@/mock/mock-errors'
import { newId, paginate, sortItems } from '@/mock/mock-helpers'
import type { PaginatedResult } from '@/types/api'
import type {
  InternalBarcodeDto,
  ProductDto,
  ProductGroupDto,
  ProductGroupRecord,
  ProductLookupDto,
  ProductQuery,
  ProductRecord,
  ProductStatus,
  ProductUnitRecord,
  SaveProductGroupRequest,
  SaveProductRequest,
  UpdateProductPricesRequest,
} from '@/types/retail-pos'

/**
 * Handler mock `/api/product-groups`, `/api/products` (07 §2.1, §2.2; UC-01). Đọc, ghi qua `posDb` của lõi.
 * Kiểm tra theo đúng thứ tự, câu lỗi bảng 07 §2.2.
 */

const PRICE_MESSAGE = 'Giá phải là bội số của 500 ₫'
const FACTOR_MESSAGE = 'Hệ số là số nguyên từ 2 đến 1.000'
const BARCODE_MESSAGE = 'Mã vạch gồm 8 đến 14 chữ số'

const validPrice = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v % posRules.priceStep === 0
const clean = (v: string | null | undefined) => (v ?? '').trim() || null
const now = () => new Date().toISOString()

// ───────────────────────── Nhóm hàng ─────────────────────────

function toGroupDto(g: ProductGroupRecord, counts: Map<string, number>): ProductGroupDto {
  return {
    id: g.id,
    code: g.code,
    name: g.name,
    color: g.color,
    sortOrder: g.sortOrder,
    isHidden: g.isHidden,
    productCount: counts.get(g.id) ?? 0,
  }
}

function productCounts() {
  const counts = new Map<string, number>()
  for (const p of posDb.products.all()) counts.set(p.groupId, (counts.get(p.groupId) ?? 0) + 1)
  return counts
}

function validateGroup(input: SaveProductGroupRequest, id?: string) {
  const name = input.name?.trim()
  if (!name) throw fieldError({ name: 'Nhập tên nhóm hàng' })
  const key = normalizeVi(name)
  if (posDb.groups.some((g) => g.id !== id && normalizeVi(g.name) === key)) {
    throw conflict('Tên nhóm hàng đã tồn tại', { name: 'Tên nhóm hàng đã tồn tại' })
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(input.color ?? '')) throw fieldError({ color: 'Màu dạng #RRGGBB' })
  return { name, color: input.color.toUpperCase() }
}

export const productGroupMock = {
  async list(): Promise<ProductGroupDto[]> {
    await mockDelay()
    requirePermission(permissions.products.view)
    const counts = productCounts()
    return posDb.groups
      .all()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((g) => toGroupDto(g, counts))
  },

  async create(input: SaveProductGroupRequest): Promise<ProductGroupDto> {
    await mockDelay()
    requirePermission(permissions.products.create)
    const v = validateGroup(input)
    const all = posDb.groups.all()
    const maxNo = all.reduce((m, g) => {
      const n = /^NH(\d+)$/.exec(g.code)
      return n ? Math.max(m, Number(n[1])) : m
    }, 0)
    const group = posDb.groups.insert({
      id: newId(),
      code: `NH${String(maxNo + 1).padStart(2, '0')}`,
      name: v.name,
      color: v.color,
      sortOrder: all.reduce((m, g) => Math.max(m, g.sortOrder), 0) + 10,
      isHidden: false,
      createdAt: now(),
    })
    auditCreate('ProductGroup', group)
    return toGroupDto(group, productCounts())
  },

  async update(id: string, input: SaveProductGroupRequest): Promise<ProductGroupDto> {
    await mockDelay()
    requirePermission(permissions.products.update)
    const before = posDb.groups.get(id)
    if (!before) throw notFound('Không tìm thấy nhóm hàng')
    const v = validateGroup(input, id)
    const after = posDb.groups.update(id, v)!
    auditUpdate('ProductGroup', before, after)
    return toGroupDto(after, productCounts())
  },

  async setVisibility(id: string, isHidden: boolean): Promise<void> {
    await mockDelay()
    requirePermission(permissions.products.update)
    const before = posDb.groups.get(id)
    if (!before) throw notFound('Không tìm thấy nhóm hàng')
    const after = posDb.groups.update(id, { isHidden: !!isHidden })!
    auditUpdate('ProductGroup', before, after)
  },

  async reorder(ids: string[]): Promise<void> {
    await mockDelay()
    requirePermission(permissions.products.update)
    const all = posDb.groups.all()
    const set = new Set(ids)
    if (set.size !== ids.length || set.size !== all.length || all.some((g) => !set.has(g.id))) {
      throw fieldError({ ids: 'Danh sách nhóm không đầy đủ' })
    }
    // Đánh lại 10, 20, 30… (06 §4)
    posDb.groups.replaceAll(all.map((g) => ({ ...g, sortOrder: (ids.indexOf(g.id) + 1) * 10 })))
  },
}

// ───────────────────────── Hàng hóa ─────────────────────────

function matchesSearch(p: ProductRecord, search: string): boolean {
  const term = search.trim()
  if (!term) return true
  if (/^\d{8,14}$/.test(term) && p.units.some((u) => u.barcode === term)) return true
  const haystack = normalizeVi(`${p.name} ${p.code}`)
  return normalizeVi(term)
    .split(' ')
    .every((w) => haystack.includes(w))
}

/** Mã đã dùng ở đơn vị khác (mọi mặt hàng, kể cả ngừng bán) */
function barcodeOwner(code: string, ownUnitIds: Set<string>) {
  const found = unitByBarcode(code)
  if (!found || ownUnitIds.has(found.unit.id)) return null
  return `${found.product.name} – ${found.unit.name}`
}

type UnitPlan = { id: string; name: string; factor: number; barcode: string | null; price: number; sortOrder: number }

/** Kiểm tra request theo thứ tự 07 §2.2, trả về bộ đơn vị mới (cơ bản đứng đầu) */
function validateProduct(input: SaveProductRequest, existing?: ProductRecord): UnitPlan[] {
  const units = input.units ?? []
  // 1. Trường bắt buộc, định dạng
  const errors: Record<string, string> = {}
  if (!input.name?.trim()) errors.name = 'Nhập tên mặt hàng'
  if (!input.baseUnit?.trim()) errors.baseUnit = 'Nhập đơn vị cơ bản'
  if (!input.groupId || !groupById(input.groupId)) errors.groupId = 'Chọn nhóm hàng'
  if (clean(input.barcode) && !isBarcodeFormat(clean(input.barcode)!)) errors.barcode = BARCODE_MESSAGE
  units.forEach((u, i) => {
    if (!u.name?.trim()) errors[`units[${i}].name`] = 'Nhập tên đơn vị'
    if (clean(u.barcode) && !isBarcodeFormat(clean(u.barcode)!)) errors[`units[${i}].barcode`] = BARCODE_MESSAGE
  })
  if (!Number.isInteger(input.minStock) || input.minStock < 0) errors.minStock = 'Tồn tối thiểu là số nguyên không âm'
  if (Object.keys(errors).length) throw fieldError(errors)

  // 2. Giá bội số 500 (TC-03)
  const priceErrors: Record<string, string> = {}
  if (!validPrice(input.price)) priceErrors.price = PRICE_MESSAGE
  units.forEach((u, i) => {
    if (!validPrice(u.price)) priceErrors[`units[${i}].price`] = PRICE_MESSAGE
  })
  if (Object.keys(priceErrors).length) throw posError('GiaKhongHopLe', PRICE_MESSAGE, { errors: priceErrors })

  // 3. Hệ số, số đơn vị quy đổi
  const factorErrors: Record<string, string> = {}
  units.forEach((u, i) => {
    if (!Number.isInteger(u.factor) || u.factor < posRules.minFactor || u.factor > posRules.maxFactor) {
      factorErrors[`units[${i}].factor`] = FACTOR_MESSAGE
    }
  })
  if (Object.keys(factorErrors).length) throw posError('DonViQuyDoiKhongHopLe', FACTOR_MESSAGE, { errors: factorErrors })
  if (units.length > posRules.maxConversionUnits) {
    throw posError('DonViQuyDoiKhongHopLe', 'Tối đa 3 đơn vị quy đổi', { errors: { units: 'Tối đa 3 đơn vị quy đổi' } })
  }

  // 4. Tên đơn vị trùng
  const names = new Set([normalizeVi(input.baseUnit)])
  for (let i = 0; i < units.length; i++) {
    const key = normalizeVi(units[i].name)
    if (names.has(key)) throw fieldError({ [`units[${i}].name`]: 'Tên đơn vị bị trùng' })
    names.add(key)
  }

  // 5. Mã vạch trùng (mọi đơn vị, mọi mặt hàng, kể cả trong chính request) → 409 (TC-02)
  const ownIds = new Set(existing?.units.map((u) => u.id) ?? [])
  const name = input.name.trim()
  const seen = new Map<string, string>()
  const check = (code: string | null, key: string, unitName: string) => {
    if (!code) return
    const owner = barcodeOwner(code, ownIds) ?? seen.get(code)
    if (owner) throw posError('MaVachDaDung', `Mã đã dùng cho ${owner}`, { status: 409, errors: { [key]: `Mã đã dùng cho ${owner}` } })
    seen.set(code, `${name} – ${unitName}`)
  }
  check(clean(input.barcode), 'barcode', input.baseUnit.trim())
  units.forEach((u, i) => check(clean(u.barcode), `units[${i}].barcode`, u.name.trim()))

  // 6. Đơn vị đã có chứng từ: không xóa, không đổi hệ số (BR-29)
  if (existing) {
    const requested = new Map(units.filter((u) => u.id).map((u, i) => [u.id!, { u, i }]))
    for (const old of existing.units) {
      if (old.sortOrder === 0 || !isUnitUsed(old.id)) continue
      const hit = requested.get(old.id)
      const message = `Đơn vị ${old.name} đã có trong chứng từ, không xóa, không đổi hệ số`
      if (!hit) throw posError('DonViDaDung', message, { errors: { units: message } })
      if (hit.u.factor !== old.factor) throw posError('DonViDaDung', message, { errors: { [`units[${hit.i}].factor`]: message } })
    }
  }

  const base = existing?.units.find((u) => u.sortOrder === 0)
  return [
    { id: base?.id ?? newId(), name: input.baseUnit.trim(), factor: 1, barcode: clean(input.barcode), price: input.price, sortOrder: 0 },
    ...units.map((u, i) => ({
      id: u.id && existing?.units.some((x) => x.id === u.id) ? u.id : newId(),
      name: u.name.trim(),
      factor: u.factor,
      barcode: clean(u.barcode),
      price: u.price,
      sortOrder: i + 1,
    })),
  ]
}

const toUnitRecords = (plan: UnitPlan[]): ProductUnitRecord[] =>
  plan.map((u) => ({ id: u.id, name: u.name, factor: u.factor, barcode: u.barcode, price: u.price, sortOrder: u.sortOrder }))

/** Khóa sắp xếp của danh sách (sortBy camelCase như API) */
const SORTABLE = new Set(['code', 'name', 'price', 'avgCost', 'marginPct', 'stock', 'createdAt'])

export const productMock = {
  async list(query: ProductQuery): Promise<PaginatedResult<ProductDto>> {
    await mockDelay()
    const ctx = requirePermission(permissions.products.view)
    const cost = canViewCost(ctx)
    const lowMargin = String(query.lowMargin) === 'true'
    const records = posDb.products.filter(
      (p) =>
        (!query.groupId || p.groupId === query.groupId) &&
        (!query.status || p.status === query.status) &&
        matchesSearch(p, query.search ?? '')
    )
    let dtos = records.map((r) => toProductDto(r, cost))
    if (query.stockStatus) dtos = dtos.filter((d) => d.stockStatus === query.stockStatus)
    if (lowMargin && cost) dtos = dtos.filter((d) => d.isLowMargin)
    const sortBy = query.sortBy && SORTABLE.has(query.sortBy) ? query.sortBy : 'code'
    const sortDir = query.sortDir ?? (query.sortBy ? 'desc' : 'asc')
    return paginate(sortItems(dtos, sortBy, sortDir), query)
  },

  async get(id: string): Promise<ProductDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.products.view)
    const r = productById(id)
    if (!r) throw notFound('Không tìm thấy mặt hàng')
    return toProductDto(r, canViewCost(ctx))
  },

  async getMany(ids: string[]): Promise<ProductDto[]> {
    await mockDelay()
    const ctx = requirePermission(permissions.products.view)
    const cost = canViewCost(ctx)
    return ids.map((id) => productById(id)).filter((r): r is ProductRecord => !!r).map((r) => toProductDto(r, cost))
  },

  async lookup(barcode: string): Promise<ProductLookupDto> {
    await mockDelay(150, 250)
    const ctx = requirePermission(permissions.products.view)
    const code = (barcode ?? '').trim()
    const found = unitByBarcode(code)
    if (!found) throw notFound(`Không tìm thấy mã vạch ${code}`)
    return { product: toProductDto(found.product, canViewCost(ctx)), unitId: found.unit.id }
  },

  async create(input: SaveProductRequest): Promise<ProductDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.products.create)
    const plan = validateProduct(input)
    const maxNo = posDb.products.all().reduce((m, p) => {
      const n = /^SP(\d+)$/.exec(p.code)
      return n ? Math.max(m, Number(n[1])) : m
    }, 0)
    const group = groupById(input.groupId)!
    const record: ProductRecord = {
      id: newId(),
      code: `SP${String(maxNo + 1).padStart(5, '0')}`,
      name: input.name.trim(),
      groupId: input.groupId,
      units: toUnitRecords(plan),
      avgCost: Math.max(0, Math.round(input.initialCost ?? 0)),
      stock: 0,
      minStock: input.minStock,
      trackExpiry: !!input.trackExpiry,
      returnable: input.returnable !== false,
      status: input.status === 'NgungBan' ? 'NgungBan' : 'DangBan',
      imageUrl: clean(input.imageUrl),
      color: input.color && /^#[0-9A-Fa-f]{6}$/.test(input.color) ? input.color.toUpperCase() : group.color,
      openingStock: 0,
      createdAt: now(),
      updatedAt: null,
    }
    posDb.products.insert(record)
    auditCreate('Product', record)
    return toProductDto(record, canViewCost(ctx))
  },

  async update(id: string, input: SaveProductRequest): Promise<ProductDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.products.update)
    const before = posDb.products.get(id)
    if (!before) throw notFound('Không tìm thấy mặt hàng')
    const plan = validateProduct(input, before)
    const group = groupById(input.groupId)!
    const after = posDb.products.update(id, {
      name: input.name.trim(),
      groupId: input.groupId,
      units: toUnitRecords(plan),
      minStock: input.minStock,
      trackExpiry: !!input.trackExpiry,
      returnable: input.returnable !== false,
      status: input.status === 'NgungBan' ? 'NgungBan' : 'DangBan',
      imageUrl: clean(input.imageUrl),
      color: input.color && /^#[0-9A-Fa-f]{6}$/.test(input.color) ? input.color.toUpperCase() : group.color,
      updatedAt: now(),
    })!
    auditUpdate('Product', before, after)
    return toProductDto(after, canViewCost(ctx))
  },

  async setStatus(id: string, status: ProductStatus): Promise<void> {
    await mockDelay()
    requirePermission(permissions.products.update)
    const before = posDb.products.get(id)
    if (!before) throw notFound('Không tìm thấy mặt hàng')
    if (status !== 'DangBan' && status !== 'NgungBan') throw fieldError({ status: 'Trạng thái không hợp lệ' })
    const after = posDb.products.update(id, { status, updatedAt: now() })!
    auditUpdate('Product', before, after)
  },

  /** Sửa nhanh giá sau nhập kho (UC-14 bước 6, TC-40) */
  async updatePrices(id: string, input: UpdateProductPricesRequest): Promise<ProductDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.products.update)
    const before = posDb.products.get(id)
    if (!before) throw notFound('Không tìm thấy mặt hàng')
    const prices = input.prices ?? []
    const errors: Record<string, string> = {}
    prices.forEach((p, i) => {
      if (!before.units.some((u) => u.id === p.unitId)) errors[`prices[${i}].unitId`] = 'Đơn vị không thuộc mặt hàng'
      else if (!validPrice(p.price)) errors[`prices[${i}].price`] = PRICE_MESSAGE
    })
    if (Object.keys(errors).length) {
      const first = Object.values(errors)[0]
      throw first === PRICE_MESSAGE ? posError('GiaKhongHopLe', PRICE_MESSAGE, { errors }) : fieldError(errors)
    }
    const map = new Map(prices.map((p) => [p.unitId, p.price]))
    const after = posDb.products.update(id, {
      units: before.units.map((u) => (map.has(u.id) ? { ...u, price: map.get(u.id)! } : u)),
      updatedAt: now(),
    })!
    auditUpdate('Product', before, after)
    return toProductDto(after, canViewCost(ctx))
  },

  async remove(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.products.delete)
    const before = posDb.products.get(id)
    if (!before) throw notFound('Không tìm thấy mặt hàng')
    if (productHasDocuments(id)) {
      throw posError('HangDaCoChungTu', 'Mặt hàng đã có chứng từ, không xóa được. Chuyển sang Ngừng bán')
    }
    posDb.products.remove(id)
    auditDelete('Product', before)
  },

  async internalBarcode(): Promise<InternalBarcodeDto> {
    await mockDelay(150, 250)
    requirePermission(permissions.products.create, permissions.products.update)
    const codes = posDb.products.all().flatMap((p) => p.units.map((u) => u.barcode))
    return { barcode: nextInternalBarcode(codes) }
  },
}
