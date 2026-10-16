import { permissions } from '@/config/permissions'
import { posRules } from '@/config/pos-rules'
import { mockDelay } from '@/lib/data-source'
import { requirePermission } from '@/mock/mock-auth'
import { mockDb } from '@/mock/mock-db'
import { validation } from '@/mock/mock-errors'
import { newId } from '@/mock/mock-helpers'
import {
  effectivePermissions,
  isSuperAdmin,
  liveUsers,
  loginAttemptsDb,
  verifyPassword,
} from '@/mock/system-data'
import type { ApprovalAction, ApprovalDto, ApprovalRequest } from '@/types/retail-pos'
import { posError, PosErrors } from './pos.errors'

/**
 * POST /api/approvals (07 §2.5, FR-16, FR-25): chủ cửa hàng gõ tài khoản ngay trên máy bán hàng.
 * Không tạo phiên; sai tên/mật khẩu → 400 `SaiTaiKhoanXacNhan` (không 401), vẫn đếm sai mật khẩu chung với
 * đăng nhập (BR-SYS-03, 5 lần/5 phút); thiếu quyền → 403 `KhongCoQuyenXacNhan`. Token giữ trong biến module
 * của tab, 15 phút, dùng một lần, gắn `action`.
 */

type TokenEntry = { action: ApprovalAction; userId: string; username: string; expiresAt: number }
const tokens = new Map<string, TokenEntry>()
mockDb.onReset(() => tokens.clear())

const MAX_FAILED = 5
const LOCK_MINUTES = 5

function lockedMessage(lockedUntil: string) {
  const minutes = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60_000))
  return `Tài khoản tạm khóa đăng nhập, thử lại sau ${minutes} phút`
}

function recordFailure(key: string): never {
  const attempt = loginAttemptsDb.get(key)
  const expired = !!attempt?.lockedUntil && new Date(attempt.lockedUntil).getTime() <= Date.now()
  const failedCount = (expired ? 0 : (attempt?.failedCount ?? 0)) + 1
  if (failedCount >= MAX_FAILED) {
    const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
    const record = { id: key, failedCount: 0, lockedUntil }
    if (attempt) loginAttemptsDb.update(key, record)
    else loginAttemptsDb.insert(record)
    throw posError('SaiTaiKhoanXacNhan', lockedMessage(lockedUntil))
  }
  if (attempt) loginAttemptsDb.update(key, { failedCount, lockedUntil: null })
  else loginAttemptsDb.insert({ id: key, failedCount, lockedUntil: null })
  throw PosErrors.wrongCredentials()
}

export const approvalsMock = {
  async create(request: ApprovalRequest): Promise<ApprovalDto> {
    await mockDelay(250, 400)
    if (request.action !== 'GiamGia' && request.action !== 'DoiTra') {
      throw validation({ action: 'Thao tác cần xác nhận không hợp lệ' })
    }
    requirePermission(request.action === 'GiamGia' ? permissions.orders.discount : permissions.returns.create)
    const username = request.username?.trim().toLowerCase()
    const user = username ? liveUsers().find((u) => u.username.toLowerCase() === username) : undefined
    if (!user) throw PosErrors.wrongCredentials()
    const key = user.username.toLowerCase()
    const attempt = loginAttemptsDb.get(key)
    if (attempt?.lockedUntil && new Date(attempt.lockedUntil).getTime() > Date.now()) {
      throw posError('SaiTaiKhoanXacNhan', lockedMessage(attempt.lockedUntil))
    }
    if (!request.password || !verifyPassword(user, request.password)) recordFailure(key)
    if (!user.isActive) throw posError('SaiTaiKhoanXacNhan', 'Tài khoản đã bị khóa, liên hệ quản trị viên')
    const needed = request.action === 'GiamGia' ? permissions.orders.discountOverride : permissions.returns.override
    if (!isSuperAdmin(user) && !effectivePermissions(user).includes(needed)) {
      throw PosErrors.noApprovalRight(request.action === 'DoiTra')
    }
    const token = (newId() + newId()).replace(/-/g, '')
    const expiresAt = Date.now() + posRules.approvalTtlMinutes * 60_000
    tokens.set(token, { action: request.action, userId: user.id, username: user.username, expiresAt })
    return {
      token,
      action: request.action,
      approvedById: user.id,
      approvedByName: user.username,
      expiresAt: new Date(expiresAt).toISOString(),
    }
  },
}

/** Token còn hợp lệ cho `action` (chưa tiêu) */
export function peekApproval(token: string | undefined | null, action: ApprovalAction): TokenEntry | undefined {
  const entry = token ? tokens.get(token) : undefined
  return entry && entry.action === action && entry.expiresAt >= Date.now() ? entry : undefined
}

/** Tiêu token một lần; sai, hết hạn, đã dùng, sai action → `MaXacNhanKhongHopLe` */
export function consumeApproval(token: string | undefined | null, action: ApprovalAction): TokenEntry {
  const entry = peekApproval(token, action)
  if (!entry || !token) {
    if (token) tokens.delete(token)
    throw PosErrors.invalidApproval()
  }
  tokens.delete(token)
  return entry
}
