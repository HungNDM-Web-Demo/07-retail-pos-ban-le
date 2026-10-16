import type {
  AdjustmentReason,
  ApprovalAction,
  DiscountReason,
  DiscountType,
  GoodsReceiptStatus,
  LotStatus,
  MovementType,
  OrderReturnStatus,
  PaymentMethod,
  ProductStatus,
  RefundMethod,
  ReturnCondition,
  ReturnReason,
  ShiftStatus,
  StockStatus,
} from '@/types/retail-pos'

/**
 * Chữ hiển thị của enum nghiệp vụ (docs/07-DANH-SACH-API.md §2), dùng chung FE-Bán hàng và FE-Quản lý.
 * Kèm biến thể StatusBadge gợi ý (`success`, `warning`, `danger`, `info`, `primary`, `neutral`).
 */
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral'

export const productStatusLabels: Record<ProductStatus, string> = {
  DangBan: 'Đang bán',
  NgungBan: 'Ngừng bán',
}
export const productStatusVariants: Record<ProductStatus, BadgeVariant> = {
  DangBan: 'success',
  NgungBan: 'neutral',
}

export const stockStatusLabels: Record<StockStatus, string> = {
  AmKho: 'Âm kho',
  HetHang: 'Hết hàng',
  SapHet: 'Sắp hết',
  ConHang: 'Còn hàng',
}
export const stockStatusVariants: Record<StockStatus, BadgeVariant> = {
  AmKho: 'danger',
  HetHang: 'danger',
  SapHet: 'warning',
  ConHang: 'success',
}

export const discountTypeLabels: Record<DiscountType, string> = {
  PhanTram: 'Phần trăm',
  SoTien: 'Số tiền',
}
export const discountReasonLabels: Record<DiscountReason, string> = {
  KhachQuen: 'Khách quen',
  HangMopMeo: 'Hàng móp méo',
  CanHanSuDung: 'Cận hạn sử dụng',
  Khac: 'Khác',
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  TienMat: 'Tiền mặt',
  ChuyenKhoan: 'Chuyển khoản',
  The: 'Thẻ',
  BuTruDoiHang: 'Bù trừ đổi hàng',
}
export const refundMethodLabels: Record<RefundMethod, string> = {
  TienMat: 'Tiền mặt',
  ChuyenKhoan: 'Chuyển khoản',
}

export const orderReturnStatusLabels: Record<OrderReturnStatus, string> = {
  ChuaTra: 'Đã thanh toán',
  TraMotPhan: 'Đã trả một phần',
  TraHet: 'Đã trả hết',
}
export const orderReturnStatusVariants: Record<OrderReturnStatus, BadgeVariant> = {
  ChuaTra: 'success',
  TraMotPhan: 'warning',
  TraHet: 'neutral',
}

export const returnConditionLabels: Record<ReturnCondition, string> = {
  BanLaiDuoc: 'Bán lại được',
  HangLoi: 'Hàng lỗi',
}
export const returnReasonLabels: Record<ReturnReason, string> = {
  KhachDoiY: 'Khách đổi ý',
  MuaNham: 'Mua nhầm',
  LoiNhaSanXuat: 'Lỗi nhà sản xuất',
  HetHan: 'Hết hạn',
  Khac: 'Khác',
}

export const shiftStatusLabels: Record<ShiftStatus, string> = {
  DangMo: 'Đang mở',
  DaChot: 'Đã chốt',
  CanKiemTra: 'Cần kiểm tra',
  DaKiemTra: 'Đã kiểm tra',
}
export const shiftStatusVariants: Record<ShiftStatus, BadgeVariant> = {
  DangMo: 'info',
  DaChot: 'success',
  CanKiemTra: 'danger',
  DaKiemTra: 'neutral',
}

export const goodsReceiptStatusLabels: Record<GoodsReceiptStatus, string> = {
  Nhap: 'Nháp',
  DaNhapKho: 'Đã nhập kho',
}
export const goodsReceiptStatusVariants: Record<GoodsReceiptStatus, BadgeVariant> = {
  Nhap: 'warning',
  DaNhapKho: 'success',
}

export const adjustmentReasonLabels: Record<AdjustmentReason, string> = {
  Hong: 'Hỏng',
  HetHan: 'Hết hạn',
  Mat: 'Mất',
  DemLai: 'Đếm lại',
  Khac: 'Khác',
}

export const movementTypeLabels: Record<MovementType, string> = {
  TonDau: 'Tồn đầu kỳ',
  BanHang: 'Bán hàng',
  TraHang: 'Trả hàng',
  NhapHang: 'Nhập hàng',
  DieuChinh: 'Điều chỉnh',
}

export const lotStatusLabels: Record<LotStatus, string> = {
  ConHan: 'Còn hạn',
  SapHetHan: 'Sắp hết hạn',
  DaHetHan: 'Đã hết hạn',
}
export const lotStatusVariants: Record<LotStatus, BadgeVariant> = {
  ConHan: 'success',
  SapHetHan: 'warning',
  DaHetHan: 'danger',
}

export const approvalActionLabels: Record<ApprovalAction, string> = {
  GiamGia: 'Giảm giá',
  DoiTra: 'Đổi trả',
}

/** Mệnh giá đếm tiền khi chốt ca (UC-09 bước 3), lớn tới nhỏ */
export const cashDenominations = [
  500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500,
] as const

/** Phím tắt màn bán hàng (NFR-01) */
export const posHotkeys = {
  search: 'F2',
  priceCheck: 'F3',
  customer: 'F4',
  newTab: 'F6',
  nextTab: 'F7',
  discount: 'F8',
  checkout: 'F9',
} as const

/** Kiểu ảnh bao bì của hàng hóa (`/seed/products/{kiểu}.webp`), dùng cho ô chọn ảnh khi thêm mặt hàng */
export const productImageKinds: Record<string, string> = {
  'banh-mi': 'Túi bánh mì',
  'bo-rau': 'Bó rau',
  'can-dau': 'Chai, can dầu ăn',
  'chai-dau-goi': 'Chai dầu gội, sữa tắm',
  'chai-gia-vi': 'Chai gia vị',
  'chai-nhua': 'Chai nhựa',
  'chai-tay-rua': 'Chai tẩy rửa',
  'chai-thuy-tinh': 'Chai thủy tinh',
  'cuon-giay': 'Lốc giấy cuộn',
  'goi-keo': 'Gói bánh kẹo',
  'goi-mi': 'Gói mì',
  'goi-snack': 'Gói snack',
  'hop-banh': 'Hộp giấy',
  'hop-giay': 'Hộp sữa, nước',
  'hop-sua-chua': 'Hũ sữa chua',
  'hop-thiec': 'Đồ hộp',
  hu: 'Hũ',
  'khay-thit': 'Khay thịt cá',
  'khay-trung': 'Hộp trứng',
  lon: 'Lon',
  'lon-sua-bot': 'Lon sữa bột',
  'ly-mi': 'Ly, tô mì',
  'trai-cay': 'Túi trái cây, củ',
  'tui-dong-lanh': 'Túi đông lạnh',
  'tui-gao': 'Túi gạo, đồ khô',
  'tui-giat': 'Túi bột giặt, tã',
  tuyp: 'Tuýp',
  vi: 'Vỉ',
}
export const productImageUrl = (kind: string) => `/seed/products/${kind}.webp`
