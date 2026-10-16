import { permissions } from '@/config/permissions'
import { nextDocCode } from '@/features/pos/lib/doc-code'
import { stockStatus, stockText } from '@/features/pos/lib/stock-math'
import { inVnRange, vnTodayKey } from '@/features/pos/lib/vn-time'
import { allAdjustments, groupById, posDb, productById } from '@/features/pos/mock/pos.db'
import { fieldError } from '@/features/pos/mock/pos.errors'
import { mockDelay } from '@/lib/data-source'
import { normalizeVi } from '@/lib/normalize'
import { auditCreate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { mockDb } from '@/mock/mock-db'
import { notFound } from '@/mock/mock-errors'
import { newId, paginate, sortItems } from '@/mock/mock-helpers'
import { usersDb } from '@/mock/system-data'
import type { PaginatedResult } from '@/types/api'
import type {
  CreateStockAdjustmentRequest,
  ProductRecord,
  StockAdjustmentDto,
  StockAdjustmentListItem,
  StockAdjustmentQuery,
  StockAdjustmentRecord,
  StockItem,
  StockLotDto,
  StockLotQuery,
  StockMovementDto,
  StockQuery,
  StockStatus,
  StockSummary,
} from '@/types/retail-pos'
import { allLots, movementsOf } from './ledger'

/** Handler mock `/api/stock`, `/api/stock-adjustments` (07 §2.8; UC-12, UC-13). */

const isTrue = (v: unknown) => v === true || v === 'true'

/** Tên hiển thị của tài khoản lập chứng từ (chụp theo tên đăng nhập) */
export const fullNameOf = (username: string): string =>
  usersDb.find((u) => u.username === username)?.fullName ?? username

function toStockItem(p: ProductRecord): StockItem {
  const units = [...p.units].sort((a, b) => a.sortOrder - b.sortOrder)
  return {
    productId: p.id,
    code: p.code,
    name: p.name,
    groupId: p.groupId,
    groupName: groupById(p.groupId)?.name ?? '',
    baseUnit: units[0]?.name ?? '',
    stock: p.stock,
    stockText: stockText(p.stock, units),
    avgCost: p.avgCost,
    stockValue: p.stock * p.avgCost,
    minStock: p.minStock,
    status: stockStatus(p.stock, p.minStock),
    productStatus: p.status,
    trackExpiry: p.trackExpiry,
  }
}

function matches(p: ProductRecord, search?: string) {
  const term = (search ?? '').trim()
  if (!term) return true
  if (/^\d{8,14}$/.test(term) && p.units.some((u) => u.barcode === term)) return true
  const hay = normalizeVi(`${p.name} ${p.code}`)
  return normalizeVi(term)
    .split(' ')
    .every((w) => hay.includes(w))
}

function filterItems(query: Pick<StockQuery, 'groupId' | 'status' | 'includeInactive' | 'search'>) {
  const includeInactive = isTrue(query.includeInactive)
  return posDb.products
    .filter(
      (p) =>
        (includeInactive || p.status === 'DangBan') &&
        (!query.groupId || p.groupId === query.groupId) &&
        matches(p, query.search)
    )
    .map(toStockItem)
    .filter((it) => !query.status || it.status === query.status)
}

const SORTABLE = new Set(['code', 'name', 'stock', 'avgCost', 'stockValue', 'minStock'])

export const stockMock = {
  async list(query: StockQuery): Promise<PaginatedResult<StockItem>> {
    await mockDelay()
    requirePermission(permissions.stockLevels.view)
    const items = filterItems(query)
    const sortBy = query.sortBy && SORTABLE.has(query.sortBy) ? query.sortBy : 'code'
    return paginate(sortItems(items, sortBy, query.sortDir ?? (query.sortBy ? 'desc' : 'asc')), query)
  },

  async summary(query: Pick<StockQuery, 'groupId' | 'status' | 'includeInactive'>): Promise<StockSummary> {
    await mockDelay()
    requirePermission(permissions.stockLevels.view)
    const items = filterItems(query)
    // Đếm trạng thái: hàng đang bán, theo nhóm đang lọc (BR-26: hàng ngừng bán không tính cảnh báo)
    const byStatus: Record<StockStatus, number> = { AmKho: 0, HetHang: 0, SapHet: 0, ConHang: 0 }
    for (const it of filterItems({ groupId: query.groupId })) byStatus[it.status]++
    const lots = allLots()
    return {
      totalValue: items.reduce((s, it) => s + it.stockValue, 0),
      productCount: items.length,
      byStatus,
      expiringLotCount: lots.filter((l) => l.status === 'SapHetHan').length,
      expiredLotCount: lots.filter((l) => l.status === 'DaHetHan').length,
    }
  },

  async lots(query: StockLotQuery): Promise<StockLotDto[]> {
    await mockDelay()
    requirePermission(permissions.stockLevels.view)
    return allLots().filter((l) => {
      if (query.productId && l.productId !== query.productId) return false
      if (query.status) return l.status === query.status
      if (query.productId) return l.remainingQty > 0
      return l.status === 'SapHetHan' || l.status === 'DaHetHan'
    })
  },

  async movements(productId: string, query: { page?: number; pageSize?: number }): Promise<PaginatedResult<StockMovementDto>> {
    await mockDelay()
    requirePermission(permissions.stockLevels.view)
    if (!productById(productId)) throw notFound('Không tìm thấy mặt hàng')
    return paginate([...movementsOf(productId)].reverse(), query)
  },
}

// ───────────────────────── Phiếu điều chỉnh ─────────────────────────

function toAdjustmentDto(a: StockAdjustmentRecord): StockAdjustmentDto {
  const lines = a.lines.map((l) => {
    const p = productById(l.productId)
    const base = p ? ([...p.units].sort((x, y) => x.sortOrder - y.sortOrder)[0]?.name ?? '') : ''
    const difference = l.actualQty - l.systemQty
    return {
      productId: l.productId,
      productCode: p?.code ?? '',
      productName: p?.name ?? '',
      baseUnit: base,
      systemQty: l.systemQty,
      actualQty: l.actualQty,
      difference,
      unitCost: l.unitCost,
      value: difference * l.unitCost,
    }
  })
  return {
    id: a.id,
    code: a.code,
    createdAt: a.createdAt,
    createdByName: fullNameOf(a.createdBy),
    reason: a.reason,
    note: a.note ?? undefined,
    goodsReceiptLineId: a.goodsReceiptLineId ?? undefined,
    lines,
    totalValue: lines.reduce((s, l) => s + l.value, 0),
  }
}

function toAdjustmentListItem(a: StockAdjustmentRecord): StockAdjustmentListItem {
  return {
    id: a.id,
    code: a.code,
    createdAt: a.createdAt,
    createdByName: fullNameOf(a.createdBy),
    reason: a.reason,
    note: a.note ?? undefined,
    lineCount: a.lines.length,
    totalValue: a.lines.reduce((s, l) => s + (l.actualQty - l.systemQty) * l.unitCost, 0),
  }
}

const REASONS = ['Hong', 'HetHan', 'Mat', 'DemLai', 'Khac']

export const stockAdjustmentMock = {
  async list(query: StockAdjustmentQuery): Promise<PaginatedResult<StockAdjustmentListItem>> {
    await mockDelay()
    requirePermission(permissions.stockLevels.view)
    const term = normalizeVi(query.search)
    const items = allAdjustments()
      .filter(
        (a) =>
          (!query.reason || a.reason === query.reason) &&
          inVnRange(a.createdAt, query.from, query.to) &&
          (!term || normalizeVi(`${a.code} ${a.note ?? ''}`).includes(term))
      )
      .map(toAdjustmentListItem)
    return paginate(sortItems(items, 'createdAt', 'desc'), query)
  },

  async get(id: string): Promise<StockAdjustmentDto> {
    await mockDelay()
    requirePermission(permissions.stockLevels.view)
    const a = allAdjustments().find((x) => x.id === id)
    if (!a) throw notFound('Không tìm thấy phiếu điều chỉnh')
    return toAdjustmentDto(a)
  },

  /** Lưu là áp dụng ngay (BR-28): tồn = thực tế, giá vốn giữ nguyên */
  async create(input: CreateStockAdjustmentRequest): Promise<StockAdjustmentDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.stockAdjustments.create)
    if (!REASONS.includes(input.reason)) throw fieldError({ reason: 'Chọn lý do' })
    if (input.reason === 'Khac' && !input.note?.trim()) throw fieldError({ note: 'Nhập ghi chú' })
    const lines = input.lines ?? []
    if (lines.length === 0) throw fieldError({ lines: 'Thêm ít nhất một mặt hàng' })
    const seen = new Set<string>()
    lines.forEach((l, i) => {
      if (!productById(l.productId)) throw fieldError({ [`lines[${i}].productId`]: 'Không tìm thấy mặt hàng' })
      if (!Number.isInteger(l.actualQty) || l.actualQty < 0) throw fieldError({ [`lines[${i}].actualQty`]: 'Số lượng thực tế không âm' })
      if (seen.has(l.productId)) throw fieldError({ lines: 'Mặt hàng bị trùng' }, 'Mặt hàng bị trùng')
      seen.add(l.productId)
    })
    const applied = lines
      .map((l) => {
        const p = productById(l.productId)!
        return { productId: p.id, systemQty: p.stock, actualQty: l.actualQty, unitCost: p.avgCost }
      })
      .filter((l) => l.actualQty !== l.systemQty)
    if (applied.length === 0) throw fieldError({ lines: 'Không có chênh lệch để điều chỉnh' })

    const createdAt = new Date().toISOString()
    const record: StockAdjustmentRecord = {
      id: newId(),
      code: nextDocCode('DC', 3, vnTodayKey(), allAdjustments().map((a) => a.code)),
      createdAt,
      createdBy: ctx.user.username,
      reason: input.reason,
      note: input.note?.trim() || null,
      goodsReceiptLineId: input.goodsReceiptLineId ?? null,
      lines: applied,
    }
    mockDb.batch(() => {
      posDb.adjustments.insert(record)
      for (const l of applied) posDb.products.update(l.productId, { stock: l.actualQty, updatedAt: createdAt })
    })
    auditCreate('StockAdjustment', record)
    return toAdjustmentDto(record)
  },
}
