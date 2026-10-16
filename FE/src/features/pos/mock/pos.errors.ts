import { ApiError } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import type { ApprovalReason, OverStockLine, PosErrorCode } from '@/types/retail-pos'
import { unitWord } from '../lib/stock-math'

/**
 * Lỗi nghiệp vụ đúng 07 §2.12: ProblemDetails có `code` và trường mở rộng, `detail` đúng chữ.
 * Dùng chung mọi handler mock của dự án (FE-Bán hàng và FE-Quản lý).
 */

type FieldErrors = Record<string, string>
const toErrors = (errors?: FieldErrors) =>
  errors ? { errors: Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, [v]])) } : {}

/** Lỗi có mã nghiệp vụ (mặc định 400) */
export function posError(
  code: PosErrorCode,
  detail: string,
  options: { status?: number; errors?: FieldErrors; extra?: Record<string, unknown> } = {}
): ApiError {
  return ApiError.fromStatus(options.status ?? 400, detail, {
    code,
    ...toErrors(options.errors),
    ...(options.extra ?? {}),
  } as Record<string, unknown>)
}

/** Lỗi 400 theo trường, không có mã nghiệp vụ; `detail` mặc định là câu đầu tiên */
export function fieldError(errors: FieldErrors, detail?: string): ApiError {
  return ApiError.fromStatus(400, detail ?? Object.values(errors)[0], toErrors(errors))
}

export const PosErrors = {
  noShift: (forReturn = false) =>
    posError('ChuaMoCa', forReturn ? 'Mở ca trước khi đổi trả' : 'Chưa mở ca, mở ca trước khi bán hàng'),
  shiftNotOpen: () => posError('ChuaMoCa', 'Chưa mở ca'),
  emptyCart: () => posError('GioTrong', 'Hóa đơn chưa có hàng', { errors: { lines: 'Hóa đơn chưa có hàng' } }),
  inactive: (name: string, i: number, key = 'lines') =>
    posError('HangNgungBan', `Hàng ngừng bán: ${name}`, {
      errors: { [`${key}[${i}].productId`]: 'Hàng ngừng bán' },
    }),
  badUnit: () => posError('DonViKhongHopLe', 'Đơn vị không còn bán, tải lại danh mục'),
  badQty: (i: number, key = 'lines') =>
    posError('SoLuongKhongHopLe', 'Số lượng từ 1 đến 9.999', {
      errors: { [`${key}[${i}].quantity`]: 'Số lượng từ 1 đến 9.999' },
    }),
  overStock: (lines: OverStockLine[]) =>
    posError('VuotTon', `Vượt tồn ${lines[0].shortage} ${unitWord(lines[0].baseUnit)}: ${lines[0].productName}`, {
      extra: { overStock: lines },
    }),
  discountTooLarge: (key: string) =>
    posError('GiamQuaTongTien', 'Số tiền giảm lớn hơn tổng tiền hàng', {
      errors: { [key]: 'Số tiền giảm lớn hơn tổng tiền hàng' },
    }),
  needApproval: (reasons: ApprovalReason[]) =>
    posError('CanXacNhan', `Cần chủ cửa hàng xác nhận: ${reasons.map((r) => r.text).join('; ')}`, {
      extra: { approvalReasons: reasons },
    }),
  invalidApproval: () =>
    posError('MaXacNhanKhongHopLe', 'Xác nhận của chủ cửa hàng không hợp lệ hoặc đã hết hạn, xác nhận lại'),
  notEnoughCash: (missing: number, key = 'payment.cashReceived') =>
    posError('TienKhongDu', `Còn thiếu ${formatVnd(missing)}`, {
      errors: { [key]: `Còn thiếu ${formatVnd(missing)}` },
    }),
  totalChanged: (serverTotal: number) =>
    posError('TongTienDaDoi', 'Tổng tiền đã thay đổi (giá hoặc giảm giá), kiểm tra lại hóa đơn', {
      status: 409,
      extra: { serverTotal },
    }),
  orderNotFound: (code: string) => posError('KhongThayHoaDon', `Không tìm thấy hóa đơn ${code}`, { status: 404 }),
  returnExpired: () => posError('QuaHanDoiTra', 'Hóa đơn đã quá 30 ngày, không nhận đổi trả'),
  fullyReturned: (code: string) => posError('DaTraHet', `Hóa đơn ${code} đã trả hết`),
  notReturnable: () => posError('HangKhongDoiTra', 'Hàng không đổi trả'),
  overReturn: (i: number, max: number) =>
    posError('VuotSoLuongTra', `Tối đa ${max}`, { errors: { [`lines[${i}].quantity`]: `Tối đa ${max}` } }),
  wrongCredentials: () => posError('SaiTaiKhoanXacNhan', 'Tên đăng nhập hoặc mật khẩu không đúng'),
  noApprovalRight: (forReturn: boolean) =>
    posError(
      'KhongCoQuyenXacNhan',
      forReturn ? 'Tài khoản không có quyền xác nhận đổi trả' : 'Tài khoản không có quyền xác nhận giảm giá',
      { status: 403 }
    ),
  needNote: () =>
    posError('CanGhiChu', 'Chênh lệch quá 20.000 ₫, cần ghi chú', {
      errors: { note: 'Chênh lệch quá 20.000 ₫, cần ghi chú' },
    }),
  shiftNotForReview: () => posError('CaKhongCanKiemTra', 'Chỉ ghi chú xử lý cho ca Cần kiểm tra'),
}

/** Đọc mã, trường mở rộng của lỗi: dùng `features/pos/lib/problem.ts` (giao diện không import mock) */
export { problemCode, problemExtra } from '../lib/problem'
