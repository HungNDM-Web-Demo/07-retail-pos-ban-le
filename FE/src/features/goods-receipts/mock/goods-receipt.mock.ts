import { permissions } from '@/config/permissions'
import { nextDocCode } from '@/features/pos/lib/doc-code'
import { isLowMargin, marginPct, nextAvgCost } from '@/features/pos/lib/stock-math'
import { vnTodayKey } from '@/features/pos/lib/vn-time'
import { allReceipts, memoOnChange, posDb, productById, supplierById } from '@/features/pos/mock/pos.db'
import { fieldError, posError } from '@/features/pos/mock/pos.errors'
import { fullNameOf } from '@/features/stock/mock/stock.mock'
import { mockDelay } from '@/lib/data-source'
import { normalizeVi } from '@/lib/normalize'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { mockDb } from '@/mock/mock-db'
import { notFound } from '@/mock/mock-errors'
import { newId, paginate, sortItems } from '@/mock/mock-helpers'
import type { PaginatedResult } from '@/types/api'
import type {
  ConfirmGoodsReceiptResult,
  GoodsReceiptDto,
  GoodsReceiptLineRecord,
  GoodsReceiptListItem,
  GoodsReceiptQuery,
  GoodsReceiptRecord,
  LowMarginItem,
  SaveGoodsReceiptRequest,
  SaveSupplierRequest,
  SupplierDto,
  SupplierQuery,
  SupplierRecord,
} from '@/types/retail-pos'

/**
 * Handler mock `/api/suppliers`, `/api/goods-receipts` (07 §2.9; UC-14). Xác nhận nhập kho tính giá vốn bình quân
 * từng dòng theo `lineNo` (BR-23, 07 §3.8), ghi `costBefore`, `costAfter`, tăng tồn; liệt kê hàng biên lãi < 5% (TC-40).
 */

const now = () => new Date().toISOString()
const clean = (v: string | null | undefined) => (v ?? '').trim() || null
const lineAmount = (l: GoodsReceiptLineRecord) => l.unitPrice * l.quantity
const totalOf = (r: GoodsReceiptRecord) => r.lines.reduce((s, l) => s + lineAmount(l), 0)

// ───────────────────────── Nhà cung cấp ─────────────────────────

const supplierStats = memoOnChange(['receipts'], () => {
  const map = new Map<string, { receiptCount: number; totalPurchased: number; lastReceiptAt?: string }>()
  for (const r of allReceipts()) {
    if (r.status !== 'DaNhapKho') continue
    const cur = map.get(r.supplierId) ?? { receiptCount: 0, totalPurchased: 0 }
    const at = r.confirmedAt ?? r.receivedDate
    map.set(r.supplierId, {
      receiptCount: cur.receiptCount + 1,
      totalPurchased: cur.totalPurchased + totalOf(r),
      lastReceiptAt: !cur.lastReceiptAt || at > cur.lastReceiptAt ? at : cur.lastReceiptAt,
    })
  }
  return map
})

function toSupplierDto(s: SupplierRecord): SupplierDto {
  const st = supplierStats().get(s.id)
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    phone: s.phone ?? undefined,
    address: s.address ?? undefined,
    note: s.note ?? undefined,
    receiptCount: st?.receiptCount ?? 0,
    totalPurchased: st?.totalPurchased ?? 0,
    lastReceiptAt: st?.lastReceiptAt,
    createdAt: s.createdAt,
  }
}

function validateSupplier(input: SaveSupplierRequest) {
  const errors: Record<string, string> = {}
  if (!input.name?.trim()) errors.name = 'Nhập tên nhà cung cấp'
  const phone = clean(input.phone)
  if (phone && !/^0\d{9}$/.test(phone)) errors.phone = 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0'
  if (Object.keys(errors).length) throw fieldError(errors)
  return { name: input.name.trim(), phone, address: clean(input.address), note: clean(input.note) }
}

export const supplierMock = {
  async list(query: SupplierQuery): Promise<PaginatedResult<SupplierDto>> {
    await mockDelay()
    requirePermission(permissions.suppliers.view)
    const term = normalizeVi(query.search)
    const items = posDb.suppliers
      .filter((s) => !term || normalizeVi(`${s.code} ${s.name} ${s.phone ?? ''}`).includes(term))
      .map(toSupplierDto)
    return paginate(sortItems(items, query.sortBy || 'code', query.sortDir || 'asc'), query)
  },

  async get(id: string): Promise<SupplierDto> {
    await mockDelay()
    requirePermission(permissions.suppliers.view)
    const s = supplierById(id)
    if (!s) throw notFound('Không tìm thấy nhà cung cấp')
    return toSupplierDto(s)
  },

  async create(input: SaveSupplierRequest): Promise<SupplierDto> {
    await mockDelay()
    requirePermission(permissions.suppliers.create)
    const v = validateSupplier(input)
    const maxNo = posDb.suppliers.all().reduce((m, s) => {
      const n = /^NCC(\d+)$/.exec(s.code)
      return n ? Math.max(m, Number(n[1])) : m
    }, 0)
    const record: SupplierRecord = { id: newId(), code: `NCC${String(maxNo + 1).padStart(3, '0')}`, ...v, createdAt: now() }
    posDb.suppliers.insert(record)
    auditCreate('Supplier', record)
    return toSupplierDto(record)
  },

  async update(id: string, input: SaveSupplierRequest): Promise<SupplierDto> {
    await mockDelay()
    requirePermission(permissions.suppliers.update)
    const before = posDb.suppliers.get(id)
    if (!before) throw notFound('Không tìm thấy nhà cung cấp')
    const after = posDb.suppliers.update(id, validateSupplier(input))!
    auditUpdate('Supplier', before, after)
    return toSupplierDto(after)
  },
}

// ───────────────────────── Phiếu nhập ─────────────────────────

function toReceiptDto(r: GoodsReceiptRecord): GoodsReceiptDto {
  return {
    id: r.id,
    code: r.code,
    supplierId: r.supplierId,
    supplierName: supplierById(r.supplierId)?.name ?? '',
    status: r.status,
    receivedDate: r.receivedDate,
    confirmedAt: r.confirmedAt ?? undefined,
    createdByName: fullNameOf(r.createdBy),
    note: r.note ?? undefined,
    lines: r.lines.map((l, i) => {
      const p = productById(l.productId)
      return {
        id: l.id,
        lineNo: i + 1,
        productId: l.productId,
        productCode: p?.code ?? '',
        productName: p?.name ?? '',
        unitId: l.unitId,
        unitName: l.unitName,
        factor: l.factor,
        quantity: l.quantity,
        baseQty: l.quantity * l.factor,
        unitPrice: l.unitPrice,
        amount: lineAmount(l),
        baseUnitCost: l.factor ? Math.round((l.unitPrice / l.factor) * 100) / 100 : l.unitPrice,
        trackExpiry: !!p?.trackExpiry,
        expiryDate: l.expiryDate ?? undefined,
        costBefore: l.costBefore ?? undefined,
        costAfter: l.costAfter ?? undefined,
      }
    }),
    totalAmount: totalOf(r),
    createdAt: r.createdAt,
  }
}

function toListItem(r: GoodsReceiptRecord): GoodsReceiptListItem {
  return {
    id: r.id,
    code: r.code,
    supplierId: r.supplierId,
    supplierName: supplierById(r.supplierId)?.name ?? '',
    status: r.status,
    receivedDate: r.receivedDate,
    confirmedAt: r.confirmedAt ?? undefined,
    lineCount: r.lines.length,
    totalAmount: totalOf(r),
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Kiểm tra phiếu khi lưu nháp (07 §2.9); trả về dòng bản ghi */
function validateReceipt(input: SaveGoodsReceiptRequest, keepIds: GoodsReceiptLineRecord[] = []): { lines: GoodsReceiptLineRecord[]; receivedDate: string } {
  const errors: Record<string, string> = {}
  if (!input.supplierId || !supplierById(input.supplierId)) errors.supplierId = 'Chọn nhà cung cấp'
  const receivedDate = input.receivedDate && DATE.test(input.receivedDate) ? input.receivedDate : vnTodayKey()
  const lines = input.lines ?? []
  if (lines.length === 0) errors.lines = 'Thêm ít nhất một mặt hàng'
  const records: GoodsReceiptLineRecord[] = []
  lines.forEach((l, i) => {
    const p = productById(l.productId)
    const unit = p?.units.find((u) => u.id === l.unitId)
    if (!p) errors[`lines[${i}].productId`] = 'Không tìm thấy mặt hàng'
    else if (!unit) errors[`lines[${i}].unitId`] = 'Chọn đơn vị'
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) errors[`lines[${i}].quantity`] = 'Số lượng lớn hơn 0'
    if (typeof l.unitPrice !== 'number' || !Number.isFinite(l.unitPrice) || l.unitPrice < 0) {
      errors[`lines[${i}].unitPrice`] = 'Đơn giá không âm'
    }
    if (l.expiryDate && !DATE.test(l.expiryDate)) errors[`lines[${i}].expiryDate`] = 'Ngày không hợp lệ'
    if (p && unit) {
      records.push({
        id: keepIds[i]?.id ?? newId(),
        productId: p.id,
        unitId: unit.id,
        unitName: unit.name,
        factor: unit.factor,
        quantity: l.quantity,
        unitPrice: Math.round(l.unitPrice),
        expiryDate: l.expiryDate || null,
        costBefore: null,
        costAfter: null,
      })
    }
  })
  if (Object.keys(errors).length) throw fieldError(errors)
  return { lines: records, receivedDate }
}

const draftOrThrow = (id: string): GoodsReceiptRecord => {
  const r = posDb.receipts.get(id) ?? allReceipts().find((x) => x.id === id)
  if (!r) throw notFound('Không tìm thấy phiếu nhập')
  if (r.status !== 'Nhap') throw posError('PhieuDaNhapKho', 'Phiếu đã nhập kho, không sửa, không xóa')
  return r
}

export const goodsReceiptMock = {
  async list(query: GoodsReceiptQuery): Promise<PaginatedResult<GoodsReceiptListItem>> {
    await mockDelay()
    requirePermission(permissions.goodsReceipts.view)
    const term = normalizeVi(query.search)
    const items = allReceipts()
      .filter(
        (r) =>
          (!query.status || r.status === query.status) &&
          (!query.supplierId || r.supplierId === query.supplierId) &&
          (!query.from || r.receivedDate >= query.from) &&
          (!query.to || r.receivedDate <= query.to) &&
          (!term || normalizeVi(r.code).includes(term))
      )
      .map((r) => ({ ...toListItem(r), createdAt: r.createdAt }))
    const sorted = sortItems(items, query.sortBy || 'createdAt', query.sortDir || 'desc')
    const page = paginate(sorted, query)
    return { ...page, items: page.items.map(({ createdAt: _c, ...rest }) => (void _c, rest)) }
  },

  async get(id: string): Promise<GoodsReceiptDto> {
    await mockDelay()
    requirePermission(permissions.goodsReceipts.view)
    const r = allReceipts().find((x) => x.id === id)
    if (!r) throw notFound('Không tìm thấy phiếu nhập')
    return toReceiptDto(r)
  },

  async create(input: SaveGoodsReceiptRequest): Promise<GoodsReceiptDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.goodsReceipts.create)
    const v = validateReceipt(input)
    const createdAt = now()
    const record: GoodsReceiptRecord = {
      id: newId(),
      code: nextDocCode('PN', 3, vnTodayKey(), allReceipts().map((r) => r.code)),
      supplierId: input.supplierId,
      status: 'Nhap',
      receivedDate: v.receivedDate,
      confirmedAt: null,
      createdBy: ctx.user.username,
      note: clean(input.note),
      lines: v.lines,
      createdAt,
    }
    posDb.receipts.insert(record)
    auditCreate('GoodsReceipt', record)
    return toReceiptDto(record)
  },

  async update(id: string, input: SaveGoodsReceiptRequest): Promise<GoodsReceiptDto> {
    await mockDelay()
    requirePermission(permissions.goodsReceipts.update)
    const before = draftOrThrow(id)
    const v = validateReceipt(input, before.lines)
    const after = posDb.receipts.update(id, {
      supplierId: input.supplierId,
      receivedDate: v.receivedDate,
      note: clean(input.note),
      lines: v.lines,
    })!
    auditUpdate('GoodsReceipt', before, after)
    return toReceiptDto(after)
  },

  async remove(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.goodsReceipts.delete)
    const before = draftOrThrow(id)
    posDb.receipts.remove(id)
    auditDelete('GoodsReceipt', before)
  },

  /** Xác nhận nhập kho (FR-35, BR-23, BR-24) */
  async confirm(id: string): Promise<ConfirmGoodsReceiptResult> {
    await mockDelay()
    requirePermission(permissions.goodsReceipts.confirm)
    const r = draftOrThrow(id)
    // Hạn sử dụng bắt buộc với hàng có HSD, phải sau ngày nhập (TC-41)
    const expiryErrors: Record<string, string> = {}
    r.lines.forEach((l, i) => {
      const p = productById(l.productId)
      if (!p?.trackExpiry) return
      if (!l.expiryDate) expiryErrors[`lines[${i}].expiryDate`] = 'Nhập hạn sử dụng'
      else if (l.expiryDate <= r.receivedDate) expiryErrors[`lines[${i}].expiryDate`] = 'Hạn sử dụng phải sau ngày nhập'
    })
    if (Object.keys(expiryErrors).length) {
      throw posError('ThieuHanSuDung', Object.values(expiryErrors)[0], { errors: expiryErrors })
    }

    // Giá vốn bình quân lần lượt theo lineNo (BR-23)
    const state = new Map<string, { stock: number; cost: number }>()
    const lines = r.lines.map((l) => {
      const p = productById(l.productId)!
      const cur = state.get(p.id) ?? { stock: p.stock, cost: p.avgCost }
      const qIn = l.quantity * l.factor
      const costAfter = nextAvgCost(cur.stock, cur.cost, qIn, l.unitPrice / l.factor)
      state.set(p.id, { stock: cur.stock + qIn, cost: costAfter })
      return { ...l, costBefore: cur.cost, costAfter }
    })
    const confirmedAt = now()
    mockDb.batch(() => {
      for (const [productId, s] of state) posDb.products.update(productId, { stock: s.stock, avgCost: s.cost, updatedAt: confirmedAt })
      posDb.receipts.update(id, { status: 'DaNhapKho', confirmedAt, lines })
    })
    const after = posDb.receipts.get(id)!
    auditUpdate('GoodsReceipt', r, after)

    const lowMarginProducts: LowMarginItem[] = []
    for (const productId of state.keys()) {
      const p = productById(productId)
      if (!p) continue
      const units = [...p.units].sort((a, b) => a.sortOrder - b.sortOrder)
      const margin = marginPct(units[0].price, p.avgCost)
      if (margin === null || !isLowMargin(margin)) continue
      lowMarginProducts.push({
        productId: p.id,
        code: p.code,
        name: p.name,
        baseUnit: units[0].name,
        price: units[0].price,
        avgCost: p.avgCost,
        marginPct: margin,
        units: units.map((u) => ({ unitId: u.id, name: u.name, factor: u.factor, price: u.price })),
      })
    }
    return { receipt: toReceiptDto(after), lowMarginProducts }
  },
}

