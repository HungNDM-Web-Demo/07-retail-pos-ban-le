import { permissions } from '@/config/permissions'
import { posRules } from '@/config/pos-rules'
import { cashDenominations } from '@/config/retail-pos-labels'
import { mockDelay } from '@/lib/data-source'
import { requirePermission, type MockSessionContext } from '@/mock/mock-auth'
import { forbidden, notFound } from '@/mock/mock-errors'
import { newId, paginate, sortItems } from '@/mock/mock-helpers'
import { hasPermission } from '@/features/pos/mock/catalog.mock'
import { nextDocCode } from '@/features/pos/lib/doc-code'
import { inVnRange, vnTodayKey } from '@/features/pos/lib/vn-time'
import { ordersOfShift, returnsOfShift, toOrderListItem, toReturnListItem, toShiftDto } from '@/features/pos/mock/mappers'
import { posDb } from '@/features/pos/mock/pos.db'
import { fieldError, PosErrors } from '@/features/pos/mock/pos.errors'
import type { PaginatedResult } from '@/types/api'
import type {
  CloseShiftRequest,
  OpenShiftRequest,
  ReviewShiftRequest,
  ShiftDetail,
  ShiftDto,
  ShiftQuery,
  ShiftRecord,
} from '@/types/retail-pos'

/**
 * Mọi API `/api/shifts` (07 §2.7; UC-02, UC-09, UC-10). Mỗi thu ngân tối đa một ca Đang mở (BR-21);
 * chốt ca tính tiền mặt lý thuyết và chênh lệch theo §3.7 (BR-21, BR-22).
 */

/** Ca đang mở của tài khoản */
export const openShiftOf = (userId: string): ShiftRecord | undefined =>
  posDb.shifts.find((s) => s.cashierId === userId && s.status === 'DangMo')

/** Người gọi có ca đang mở, không thì `ChuaMoCa` */
export function requireOpenShift(ctx: MockSessionContext, forReturn = false): ShiftRecord {
  const shift = openShiftOf(ctx.user.id)
  if (!shift) throw PosErrors.noShift(forReturn)
  return shift
}

/** Xem chứng từ của ca này được không (07 §1 "ca của mình") */
export function canSeeShift(ctx: MockSessionContext, shiftId: string): boolean {
  if (hasPermission(ctx, permissions.shifts.view)) return true
  return posDb.shifts.get(shiftId)?.cashierId === ctx.user.id
}

function getShift(id: string): ShiftRecord {
  const shift = posDb.shifts.get(id)
  if (!shift) throw notFound('Không tìm thấy ca')
  return shift
}

export const shiftMock = {
  /** GET /api/shifts/current → null khi chưa có ca (BE trả 204) */
  async current(): Promise<ShiftDto | null> {
    await mockDelay(100, 200)
    const ctx = requirePermission(permissions.shifts.operate)
    const shift = openShiftOf(ctx.user.id)
    return shift ? toShiftDto(shift) : null
  },

  /** POST /api/shifts: đã có ca mở thì trả ca đó (UC-02 E2) */
  async open(input: OpenShiftRequest): Promise<ShiftDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.shifts.operate)
    const existing = openShiftOf(ctx.user.id)
    if (existing) return toShiftDto(existing)
    const cash = Number(input.openingCash)
    if (input.openingCash === null || input.openingCash === undefined || !Number.isFinite(cash) || cash < 0) {
      throw fieldError({ openingCash: 'Nhập tiền đầu ca' })
    }
    const now = new Date().toISOString()
    const record: ShiftRecord = {
      id: newId(),
      code: nextDocCode('CA', 2, vnTodayKey(), posDb.shifts.all().map((s) => s.code)),
      cashierId: ctx.user.id,
      cashierUsername: ctx.user.username,
      cashierName: ctx.user.fullName,
      openedAt: now,
      closedAt: null,
      openingCash: Math.round(cash),
      countedCash: null,
      cashCount: null,
      status: 'DangMo',
      note: null,
      reviewNote: null,
      reviewedByName: null,
      reviewedAt: null,
    }
    posDb.shifts.insert(record)
    return toShiftDto(record)
  },

  /** POST /api/shifts/current/close (UC-09) */
  async close(input: CloseShiftRequest): Promise<ShiftDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.shifts.operate)
    const shift = openShiftOf(ctx.user.id)
    if (!shift) throw PosErrors.shiftNotOpen()
    const allowed = new Set<number>(cashDenominations)
    const items = (input.cashCount ?? []).filter((c) => c.count !== 0)
    if (items.some((c) => !allowed.has(c.denomination) || !Number.isInteger(c.count) || c.count < 0)) {
      throw fieldError({ cashCount: 'Số tờ không hợp lệ' })
    }
    const counted = items.reduce((s, c) => s + c.denomination * c.count, 0)
    const summary = toShiftDto(shift)
    const difference = counted - summary.expectedCash
    const note = input.note?.trim() || null
    if (Math.abs(difference) > posRules.shiftDifferenceThreshold && !note) throw PosErrors.needNote()
    const updated = posDb.shifts.update(shift.id, {
      closedAt: new Date().toISOString(),
      countedCash: counted,
      cashCount: items,
      note,
      status: Math.abs(difference) > posRules.shiftDifferenceThreshold ? 'CanKiemTra' : 'DaChot',
    })
    return toShiftDto(updated!)
  },

  /** GET /api/shifts (FR-29) */
  async list(query: ShiftQuery): Promise<PaginatedResult<ShiftDto>> {
    await mockDelay()
    requirePermission(permissions.shifts.view)
    const rows = posDb.shifts.filter(
      (s) =>
        inVnRange(s.openedAt, query.from, query.to) &&
        (!query.cashierId || s.cashierId === query.cashierId) &&
        (!query.status || s.status === query.status)
    )
    const sorted = sortItems(rows, query.sortBy || 'openedAt', query.sortDir || 'desc')
    const page = paginate(sorted, query)
    return { ...page, items: page.items.map(toShiftDto) }
  },

  /** GET /api/shifts/{id}: người có shifts.view hoặc ca của mình */
  async detail(id: string): Promise<ShiftDetail> {
    await mockDelay()
    const ctx = requirePermission(permissions.shifts.operate, permissions.shifts.view)
    const shift = getShift(id)
    if (!canSeeShift(ctx, id)) throw forbidden()
    const orders = [...ordersOfShift(id)].sort((a, b) => a.paidAt.localeCompare(b.paidAt))
    const returns = [...returnsOfShift(id)].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const approvals = [
      ...orders
        .filter((o) => o.approvedByName)
        .map((o) => ({
          action: 'GiamGia' as const,
          documentId: o.id,
          documentCode: o.code,
          approvedByName: o.approvedByName!,
          amount: o.lines.reduce((s, l) => s + (l.discount?.amount ?? 0), 0) + (o.orderDiscount?.amount ?? 0),
          at: o.paidAt,
        })),
      ...returns
        .filter((r) => r.approvedByName)
        .map((r) => ({
          action: 'DoiTra' as const,
          documentId: r.id,
          documentCode: r.code,
          approvedByName: r.approvedByName!,
          amount: r.refundTotal,
          at: r.createdAt,
        })),
    ].sort((a, b) => a.at.localeCompare(b.at))
    return {
      ...toShiftDto(shift),
      orders: orders.map(toOrderListItem),
      returns: returns.map(toReturnListItem),
      approvals,
    }
  },

  /** PATCH /api/shifts/{id}/review (UC-10, TC-11) */
  async review(id: string, input: ReviewShiftRequest): Promise<ShiftDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.shifts.review)
    const shift = getShift(id)
    if (shift.status !== 'CanKiemTra') throw PosErrors.shiftNotForReview()
    const note = input.note?.trim()
    if (!note) throw fieldError({ note: 'Nhập ghi chú xử lý' })
    const updated = posDb.shifts.update(id, {
      status: 'DaKiemTra',
      reviewNote: note,
      reviewedByName: ctx.user.username,
      reviewedAt: new Date().toISOString(),
    })
    return toShiftDto(updated!)
  },
}
