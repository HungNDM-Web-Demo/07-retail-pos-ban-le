/**
 * Hợp đồng dữ liệu nghiệp vụ POS Cửa hàng Bán lẻ, chép đúng docs/07-DANH-SACH-API.md §2 (07 là nguồn;
 * đổi DTO thì sửa 07 trước rồi sửa file này). BE `Application/DTOs/*` khớp từng trường.
 * Dùng chung cho FE-Bán hàng và FE-Quản lý (07 §4.9): không tách bản sao trong features/*.
 * Quy ước: `?` là có thể null hoặc vắng (BE trả null); ngày giờ chuỗi ISO UTC; ngày thuần `yyyy-MM-dd`
 * theo giờ Việt Nam; tiền là số nguyên đồng; số lượng là số nguyên.
 */

// ============================================================ Enum (06 §4, 07 §2)

export type ProductStatus = 'DangBan' | 'NgungBan'
/** BR-26, suy ra từ tồn và tồn tối thiểu */
export type StockStatus = 'AmKho' | 'HetHang' | 'SapHet' | 'ConHang'
export type DiscountType = 'PhanTram' | 'SoTien'
export type DiscountReason = 'KhachQuen' | 'HangMopMeo' | 'CanHanSuDung' | 'Khac'
/** Phương thức trên chứng từ; `BuTruDoiHang` chỉ do hệ thống ghi khi đổi hàng (BR-20) */
export type PaymentMethod = 'TienMat' | 'ChuyenKhoan' | 'The' | 'BuTruDoiHang'
/** Phương thức thu ngân chọn trong hộp thanh toán */
export type TenderMethod = 'TienMat' | 'ChuyenKhoan' | 'The'
/** Hình thức trả lại tiền cho khách ở phiếu đổi trả */
export type RefundMethod = 'TienMat' | 'ChuyenKhoan'
export type OrderReturnStatus = 'ChuaTra' | 'TraMotPhan' | 'TraHet'
export type ReturnCondition = 'BanLaiDuoc' | 'HangLoi'
export type ReturnReason = 'KhachDoiY' | 'MuaNham' | 'LoiNhaSanXuat' | 'HetHan' | 'Khac'
export type ShiftStatus = 'DangMo' | 'DaChot' | 'CanKiemTra' | 'DaKiemTra'
export type GoodsReceiptStatus = 'Nhap' | 'DaNhapKho'
export type AdjustmentReason = 'Hong' | 'HetHan' | 'Mat' | 'DemLai' | 'Khac'
export type MovementType = 'TonDau' | 'BanHang' | 'TraHang' | 'NhapHang' | 'DieuChinh'
/** BR-27 */
export type LotStatus = 'ConHan' | 'SapHetHan' | 'DaHetHan'
/** Loại xác nhận của chủ cửa hàng: giảm giá (UC-05) hoặc đổi trả (UC-07) */
export type ApprovalAction = 'GiamGia' | 'DoiTra'
export type ApprovalReasonCode = 'VuotHanMuc' | 'DuoiGiaVon' | 'QuaHanTra' | 'HoanLon'
export type ReceiptPaperSize = '80' | '58'
export type ProductSortBy = 'quantity' | 'netRevenue' | 'grossProfit'

/** Mã lỗi nghiệp vụ trong ProblemDetails.code (07 §2.12) */
export type PosErrorCode =
  | 'ChuaMoCa'
  | 'CaDaMo'
  | 'GioTrong'
  | 'HangNgungBan'
  | 'DonViKhongHopLe'
  | 'SoLuongKhongHopLe'
  | 'VuotTon'
  | 'GiamQuaTongTien'
  | 'CanXacNhan'
  | 'MaXacNhanKhongHopLe'
  | 'TienKhongDu'
  | 'TongTienDaDoi'
  | 'KhongThayHoaDon'
  | 'QuaHanDoiTra'
  | 'DaTraHet'
  | 'HangKhongDoiTra'
  | 'VuotSoLuongTra'
  | 'MaVachDaDung'
  | 'GiaKhongHopLe'
  | 'DonViQuyDoiKhongHopLe'
  | 'HangDaCoChungTu'
  | 'DonViDaDung'
  | 'PhieuDaNhapKho'
  | 'ThieuHanSuDung'
  | 'CaKhongCanKiemTra'
  | 'CanGhiChu'
  | 'SaiTaiKhoanXacNhan'
  | 'KhongCoQuyenXacNhan'

// ============================================================ Nhóm hàng (07 §2.1)

export type ProductGroupDto = {
  id: string
  code: string
  name: string
  color: string // #RRGGBB
  sortOrder: number
  isHidden: boolean
  productCount: number // mọi mặt hàng của nhóm, kể cả ngừng bán
}
export type SaveProductGroupRequest = { name: string; color: string }
export type ProductGroupVisibilityRequest = { isHidden: boolean }
export type ReorderProductGroupsRequest = { ids: string[] }

// ============================================================ Hàng hóa (07 §2.2)

export type ProductUnitDto = {
  id: string
  name: string // "Lon", "Lốc 6", "Thùng 24"
  factor: number // 1 với đơn vị cơ bản
  barcode?: string
  price: number
  isBase: boolean
  sortOrder: number // 0 là đơn vị cơ bản, 1..3 đơn vị quy đổi
  everUsed: boolean // đã có trong chứng từ → không xóa, không đổi hệ số (BR-29)
}

export type ProductDto = {
  id: string
  code: string // SP00012
  name: string
  groupId: string
  groupName: string
  groupColor: string
  baseUnit: string // tên đơn vị cơ bản
  barcode?: string // mã vạch đơn vị cơ bản
  price: number // giá bán đơn vị cơ bản
  units: ProductUnitDto[] // đủ mọi đơn vị, đơn vị cơ bản đứng đầu
  avgCost?: number // null khi người gọi thiếu products.view-cost
  marginPct?: number // BR-25, 1 chữ số thập phân; null khi thiếu products.view-cost hoặc giá 0
  isLowMargin?: boolean // marginPct < 5
  stock: number // đơn vị cơ bản, có thể âm
  stockText: string // BR-02, vd "2 thùng 2 lon", "−3 lon"
  stockStatus: StockStatus
  minStock: number
  trackExpiry: boolean
  returnable: boolean
  status: ProductStatus
  imageUrl?: string // /seed/products/{kiểu}.webp hoặc /uploads/...
  color: string // màu nền ô ảnh
  hasDocuments: boolean // đã có chứng từ → không xóa (BR-29)
  createdAt: string
}

export type ProductQuery = {
  page?: number
  pageSize?: number
  search?: string // tên không dấu, mã hàng, mã vạch mọi đơn vị
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  groupId?: string
  status?: ProductStatus
  stockStatus?: StockStatus
  lowMargin?: boolean
}

export type SaveProductUnitInput = {
  id?: string // có khi sửa đơn vị đã có
  name: string
  factor: number // 2–1.000 (BR-01)
  barcode?: string
  price: number
}

export type SaveProductRequest = {
  name: string
  groupId: string
  baseUnit: string
  barcode?: string
  price: number
  initialCost?: number // chỉ dùng khi tạo (giá vốn ban đầu); sửa thì bỏ qua
  minStock: number
  trackExpiry: boolean
  returnable: boolean
  status: ProductStatus
  imageUrl?: string
  color?: string // vắng thì lấy màu nhóm
  units: SaveProductUnitInput[] // tối đa 3, không gồm đơn vị cơ bản
}
export type ProductStatusRequest = { status: ProductStatus }
export type UpdateProductPricesRequest = { prices: { unitId: string; price: number }[] }
export type InternalBarcodeDto = { barcode: string }
/** GET /api/products/lookup?barcode= : mặt hàng và đơn vị khớp mã */
export type ProductLookupDto = { product: ProductDto; unitId: string }

// ============================================================ Danh mục cho máy bán hàng (07 §2.3)

export type PosCatalogUnit = {
  unitId: string
  name: string
  factor: number
  barcode?: string
  price: number
}
export type PosCatalogItem = {
  productId: string
  code: string
  name: string
  searchText: string // tên + mã, chữ thường, bỏ dấu (normalizeVi), để tìm không dấu tại máy
  groupId: string
  baseUnit: string
  units: PosCatalogUnit[] // đơn vị cơ bản đứng đầu
  stock: number
  minStock: number
  status: ProductStatus
  returnable: boolean
  imageUrl?: string
  color: string
}
export type PosCatalog = {
  version: string // đổi khi hàng hóa, giá, tồn đổi; FE so để làm mới
  generatedAt: string
  groups: { id: string; name: string; color: string; sortOrder: number; isHidden: boolean }[]
  items: PosCatalogItem[] // gồm cả hàng ngừng bán để báo "Hàng ngừng bán" khi quét
}

// ============================================================ Bán hàng, hóa đơn (07 §2.4)

export type DiscountInput = {
  type: DiscountType
  value: number // phần trăm 0–100 (tối đa 1 chữ số thập phân) hoặc số tiền bội số 500
  reason: DiscountReason
  note?: string // bắt buộc khi reason = Khac
}
export type CartLineInput = {
  productId: string
  unitId: string
  quantity: number // 1–9.999
  discount?: DiscountInput
}
export type CartInput = {
  lines: CartLineInput[]
  orderDiscount?: DiscountInput
  customerId?: string
}

export type ApprovalReason = { code: ApprovalReasonCode; text: string } // vd "Giảm 7,3%, vượt hạn mức 5%"

export type QuoteLine = {
  productId: string
  unitId: string
  productName: string
  unitName: string
  factor: number
  quantity: number
  baseQty: number
  unitPrice: number
  amount: number // BR-06
  discountAmount: number // giảm dòng sau làm tròn BR-07
  allocatedDiscount: number // phần giảm hóa đơn phân bổ BR-14
  netAmount: number
}
export type OverStockLine = {
  productId: string
  productName: string
  shortage: number
  baseUnit: string
} // BR-10
export type OrderQuote = {
  lines: QuoteLine[]
  subtotal: number
  lineDiscountTotal: number
  orderDiscountAmount: number
  discountTotal: number
  discountPct: number // discountTotal ÷ subtotal × 100, 1 chữ số
  total: number // BR-07
  needsApproval: boolean
  approvalReasons: ApprovalReason[] // BR-08, BR-09
  overStock: OverStockLine[]
  pointsToEarn: number // BR-31, 0 khi không gắn khách
}

export type TenderInput = {
  method: TenderMethod
  cashReceived?: number // bắt buộc khi TienMat, ≥ số phải thu (BR-12)
  reference?: string // mã chuẩn chi thẻ; nội dung chuyển khoản
}

export type CheckoutRequest = CartInput & {
  clientRequestId: string // uuid FE sinh khi mở hộp thanh toán; giữ nguyên khi bấm lại (NFR-06)
  payment: TenderInput
  approvalToken?: string // từ POST /api/approvals khi quote.needsApproval
  expectedTotal: number // tổng FE đã hiển thị; lệch → 409 TongTienDaDoi
  qrContent?: string // chuỗi QR chuyển khoản đã hiển thị, để in lại
}

export type DiscountDto = {
  type: DiscountType
  value: number
  amount: number
  reason: DiscountReason
  note?: string
}
export type PaymentDto = {
  method: PaymentMethod
  amount: number // số tiền tính vào hóa đơn (tiền mặt: sau khi trừ tiền thối)
  cashReceived?: number
  changeAmount?: number
  reference?: string
}

export type OrderLineDto = {
  id: string
  lineNo: number // 1, 2, 3… theo thứ tự trong giỏ
  productId: string
  productCode: string
  productName: string // chụp lúc bán
  unitId: string
  unitName: string
  factor: number
  quantity: number
  baseQty: number
  unitPrice: number
  amount: number
  discount?: DiscountDto
  allocatedDiscount: number
  netAmount: number // doanh thu thuần dòng (BR-14)
  unitCost?: number // giá vốn đơn vị cơ bản lúc bán (BR-13); null khi thiếu products.view-cost
  costAmount?: number
  returnable: boolean // chụp "Cho đổi trả" lúc bán
  returnedQty: number // theo đơn vị của dòng
  refundedAmount: number
}

export type OrderDto = {
  id: string
  code: string // HD + yyMMdd + 4 số
  paidAt: string
  shiftId: string
  shiftCode: string
  cashierId: string
  cashierName: string
  lines: OrderLineDto[]
  subtotal: number
  lineDiscountTotal: number
  orderDiscount?: DiscountDto
  discountTotal: number
  total: number
  costTotal?: number // null khi thiếu products.view-cost
  payments: PaymentDto[]
  approvedByName?: string // tên đăng nhập người xác nhận giảm giá (TC-22 "quanly")
  customer?: { id: string; phone: string; name: string }
  pointsEarned: number
  returnStatus: OrderReturnStatus
  note?: string // "HĐ mẫu A" trong dữ liệu mẫu
  exchangeForReturn?: { id: string; code: string } // hóa đơn đổi hàng (BR-20)
  returns: { id: string; code: string; createdAt: string; refundTotal: number }[]
  qrContent?: string
  createdAt: string
}

export type OrderListItem = {
  id: string
  code: string
  paidAt: string
  shiftCode: string
  cashierName: string
  itemCount: number // Σ quantity
  subtotal: number
  discountTotal: number
  total: number
  paymentMethods: PaymentMethod[]
  returnStatus: OrderReturnStatus
  isExchange: boolean
  customerName?: string
  approvedByName?: string
  note?: string
}

export type OrderQuery = {
  page?: number
  pageSize?: number
  search?: string // mã hóa đơn hoặc ghi chú
  sortBy?: string // mặc định paidAt
  sortDir?: 'asc' | 'desc'
  from?: string
  to?: string
  cashierId?: string
  shiftId?: string
  paymentMethod?: PaymentMethod
  returnStatus?: OrderReturnStatus
  customerId?: string
}

export type NextCodeDto = { code: string }

// ============================================================ Xác nhận của chủ cửa hàng (07 §2.5)

export type ApprovalRequest = { username: string; password: string; action: ApprovalAction }
export type ApprovalDto = {
  token: string // dùng một lần, hết hạn sau 15 phút
  action: ApprovalAction
  approvedById: string
  approvedByName: string // tên đăng nhập, vd "quanly"
  expiresAt: string
}

// ============================================================ Đổi trả (07 §2.6)

export type ReturnSourceLine = {
  orderLineId: string
  lineNo: number
  productId: string
  productName: string
  unitId: string
  unitName: string
  factor: number
  quantity: number
  returnedQty: number
  returnableQty: number // quantity − returnedQty; 0 khi hàng không đổi trả
  netAmount: number
  refundedAmount: number
  unitNetPrice: number // netAmount ÷ quantity, làm tròn 1 ₫, chỉ để hiển thị "đơn giá thực thu"
  returnable: boolean // false → dòng mờ "Hàng không đổi trả" (TC-33)
}
export type ReturnSourceOrder = {
  orderId: string
  code: string
  paidAt: string
  daysSince: number // ngày lịch, ngày mua là 0 (BR-17)
  cashierName: string
  total: number
  payments: PaymentDto[]
  customer?: { id: string; phone: string; name: string }
  lines: ReturnSourceLine[]
  needsApproval: boolean // daysSince ≥ 8
  approvalText?: string // "Hóa đơn 10 ngày, cần chủ cửa hàng xác nhận"
}
export type ReturnSourceListItem = {
  orderId: string
  code: string
  paidAt: string
  total: number
  itemCount: number
  cashierName: string
}
export type ReturnSourceQuery = {
  date?: string
  productId?: string
  search?: string
  page?: number
  pageSize?: number
}

export type ReturnLineInput = {
  orderLineId: string
  quantity: number // theo đơn vị của dòng gốc
  condition: ReturnCondition
  reason: ReturnReason
  note?: string // bắt buộc khi reason = Khac
}
export type ExchangeInput = {
  lines: { productId: string; unitId: string; quantity: number }[]
  expectedTotal: number
  payment?: TenderInput // bắt buộc khi chênh lệch dương (khách trả thêm)
  qrContent?: string
}
export type CreateReturnRequest = {
  clientRequestId: string
  orderId: string
  lines: ReturnLineInput[]
  refundMethod: RefundMethod // hình thức trả phần tiền còn lại cho khách
  note?: string
  approvalToken?: string // khi quá 7 ngày hoặc hoàn trên 500.000 ₫ (BR-17, BR-18)
  expectedRefundTotal: number
  exchange?: ExchangeInput
}

export type ReturnLineDto = {
  id: string
  orderLineId: string
  productId: string
  productCode: string
  productName: string
  unitName: string
  factor: number
  quantity: number
  baseQty: number
  condition: ReturnCondition
  reason: ReturnReason
  note?: string
  refundAmount: number // BR-18
  unitCost?: number // giá vốn đơn vị cơ bản trên dòng gốc; null khi thiếu products.view-cost
  costAmount?: number
}
export type ReturnDto = {
  id: string
  code: string // TH + yyMMdd + 4 số
  createdAt: string
  shiftId: string
  shiftCode: string
  cashierId: string
  cashierName: string
  orderId: string
  orderCode: string
  orderPaidAt: string
  lines: ReturnLineDto[]
  refundTotal: number
  offsetAmount: number // phần tiền hoàn trừ vào hóa đơn đổi (Bù trừ đổi hàng)
  payoutAmount: number // phần trả lại khách bằng refundMethod = refundTotal − offsetAmount
  refundMethod: RefundMethod
  exchangeOrder?: { id: string; code: string; total: number }
  difference: number // tổng hóa đơn đổi − tiền hoàn (BR-20); dương: khách trả thêm
  approvedByName?: string
  note?: string
  pointsDeducted: number
}
export type ReturnListItem = {
  id: string
  code: string
  createdAt: string
  cashierName: string
  orderCode: string
  refundTotal: number
  payoutAmount: number
  refundMethod: RefundMethod
  exchangeOrderCode?: string
  difference: number
  hasDefective: boolean
  approvedByName?: string
}
export type ReturnQuery = {
  page?: number
  pageSize?: number
  search?: string // mã phiếu hoặc mã hóa đơn gốc
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  from?: string
  to?: string
  cashierId?: string
  shiftId?: string
}

// ============================================================ Ca làm (07 §2.7)

export type CashCountItem = { denomination: number; count: number }
export type RefundBreakdown = { TienMat: number; ChuyenKhoan: number; BuTruDoiHang: number }

export type ShiftDto = {
  id: string
  code: string // CA + yyMMdd + 2 số
  status: ShiftStatus
  cashierId: string
  cashierName: string
  openedAt: string
  closedAt?: string
  openingCash: number
  orderCount: number
  returnCount: number
  salesByMethod: Record<PaymentMethod, number> // Σ PaymentDto.amount theo phương thức
  salesTotal: number // Σ tổng thanh toán hóa đơn
  refundByMethod: RefundBreakdown
  refundTotal: number
  netRevenue: number // salesTotal − refundTotal
  expectedCash: number // BR-21 (ca đang mở: tính tới lúc gọi)
  countedCash?: number
  difference?: number // BR-22
  cashCount?: CashCountItem[]
  note?: string
  reviewNote?: string
  reviewedByName?: string
  reviewedAt?: string
}
export type ShiftApprovalItem = {
  action: ApprovalAction
  documentId: string
  documentCode: string
  approvedByName: string
  amount: number
  at: string
}
export type ShiftDetail = ShiftDto & {
  orders: OrderListItem[]
  returns: ReturnListItem[]
  approvals: ShiftApprovalItem[]
}
export type OpenShiftRequest = { openingCash: number }
export type CloseShiftRequest = { cashCount: CashCountItem[]; note?: string }
export type ReviewShiftRequest = { note: string }
export type ShiftQuery = {
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  from?: string
  to?: string
  cashierId?: string
  status?: ShiftStatus
}

// ============================================================ Tồn kho (07 §2.8)

export type StockItem = {
  productId: string
  code: string
  name: string
  groupId: string
  groupName: string
  baseUnit: string
  stock: number
  stockText: string // BR-02
  avgCost: number
  stockValue: number // stock × avgCost (âm khi tồn âm)
  minStock: number
  status: StockStatus
  productStatus: ProductStatus
  trackExpiry: boolean
}
export type StockQuery = {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  groupId?: string
  status?: StockStatus
  includeInactive?: boolean // mặc định false: bỏ hàng ngừng bán
}
export type StockSummary = {
  totalValue: number // Σ stockValue của dòng khớp bộ lọc (groupId, status, includeInactive)
  productCount: number
  byStatus: Record<StockStatus, number> // hàng đang bán
  expiringLotCount: number
  expiredLotCount: number
}
export type StockLotDto = {
  goodsReceiptLineId: string
  goodsReceiptId: string
  goodsReceiptCode: string
  productId: string
  productCode: string
  productName: string
  baseUnit: string
  receivedAt: string
  expiryDate: string // yyyy-MM-dd
  daysLeft: number // âm khi đã hết hạn
  receivedQty: number // đơn vị cơ bản
  remainingQty: number // ước tính BR-27
  status: LotStatus
}
export type StockLotQuery = { status?: LotStatus; productId?: string }
export type StockMovementDto = {
  id: string
  at: string
  type: MovementType
  documentId?: string
  documentCode: string // HD…, TH…, PN…, DC…; "Tồn đầu kỳ" với TonDau
  quantity: number // đơn vị cơ bản, dương là tăng
  stockAfter: number
  costAfter: number
}

export type StockAdjustmentLineInput = { productId: string; actualQty: number }
export type CreateStockAdjustmentRequest = {
  reason: AdjustmentReason
  note?: string // bắt buộc khi reason = Khac
  lines: StockAdjustmentLineInput[]
  goodsReceiptLineId?: string // khi bấm "Hủy lô" (UC-13), để truy vết
}
export type StockAdjustmentLineDto = {
  productId: string
  productCode: string
  productName: string
  baseUnit: string
  systemQty: number
  actualQty: number
  difference: number
  unitCost: number
  value: number // BR-28
}
export type StockAdjustmentDto = {
  id: string
  code: string // DC + yyMMdd + 3 số
  createdAt: string
  createdByName: string
  reason: AdjustmentReason
  note?: string
  goodsReceiptLineId?: string
  lines: StockAdjustmentLineDto[]
  totalValue: number
}
export type StockAdjustmentListItem = {
  id: string
  code: string
  createdAt: string
  createdByName: string
  reason: AdjustmentReason
  note?: string
  lineCount: number
  totalValue: number
}
export type StockAdjustmentQuery = {
  page?: number
  pageSize?: number
  from?: string
  to?: string
  reason?: AdjustmentReason
  search?: string
}

// ============================================================ Nhà cung cấp, phiếu nhập (07 §2.9)

export type SupplierDto = {
  id: string
  code: string // NCC + 3 số
  name: string
  phone?: string
  address?: string
  note?: string
  receiptCount: number // phiếu đã nhập kho
  totalPurchased: number
  lastReceiptAt?: string
  createdAt: string
}
export type SaveSupplierRequest = { name: string; phone?: string; address?: string; note?: string }
export type SupplierQuery = {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export type GoodsReceiptLineInput = {
  productId: string
  unitId: string
  quantity: number // > 0
  unitPrice: number // ≥ 0, đơn giá của đơn vị đã chọn
  expiryDate?: string // yyyy-MM-dd, bắt buộc khi xác nhận nếu hàng có HSD (BR-24)
}
export type SaveGoodsReceiptRequest = {
  supplierId: string
  receivedDate?: string // yyyy-MM-dd, mặc định hôm nay
  note?: string
  lines: GoodsReceiptLineInput[]
}
export type GoodsReceiptLineDto = {
  id: string
  lineNo: number
  productId: string
  productCode: string
  productName: string
  unitId: string
  unitName: string
  factor: number
  quantity: number
  baseQty: number
  unitPrice: number
  amount: number
  baseUnitCost: number // unitPrice ÷ factor (BR-23)
  trackExpiry: boolean
  expiryDate?: string
  costBefore?: number // giá vốn bình quân trước dòng này, có sau khi nhập kho
  costAfter?: number
}
export type GoodsReceiptDto = {
  id: string
  code: string // PN + yyMMdd + 3 số
  supplierId: string
  supplierName: string
  status: GoodsReceiptStatus
  receivedDate: string // yyyy-MM-dd
  confirmedAt?: string
  createdByName: string
  note?: string
  lines: GoodsReceiptLineDto[]
  totalAmount: number
  createdAt: string
}
export type GoodsReceiptListItem = {
  id: string
  code: string
  supplierId: string
  supplierName: string
  status: GoodsReceiptStatus
  receivedDate: string
  confirmedAt?: string
  lineCount: number
  totalAmount: number
}
export type GoodsReceiptQuery = {
  page?: number
  pageSize?: number
  search?: string // mã phiếu
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  status?: GoodsReceiptStatus
  supplierId?: string
  from?: string
  to?: string
}
export type LowMarginItem = {
  productId: string
  code: string
  name: string
  baseUnit: string
  price: number
  avgCost: number
  marginPct: number
  units: { unitId: string; name: string; factor: number; price: number }[]
}
export type ConfirmGoodsReceiptResult = {
  receipt: GoodsReceiptDto
  lowMarginProducts: LowMarginItem[]
}

// ============================================================ Báo cáo (07 §2.10)

export type DateRangeQuery = { from: string; to: string } // yyyy-MM-dd giờ Việt Nam, tối đa 366 ngày

export type KpiSet = {
  netRevenue: number
  grossProfit: number
  orderCount: number
  avgOrderValue: number
}
export type DashboardDto = {
  asOf: string
  today: KpiSet
  sameTimeYesterday: KpiSet // từ 00:00 tới cùng giờ phút hôm qua
  last7Days: { date: string; netRevenue: number; grossProfit: number }[] // 7 ngày gồm hôm nay, cũ trước
  topProducts: {
    productId: string
    code: string
    name: string
    baseUnit: string
    quantity: number
    netRevenue: number
  }[] // top 10 hôm nay theo số lượng cơ bản
  lowStockCount: number // SapHet + HetHang + AmKho của hàng đang bán
  expiringLotCount: number
  expiredLotCount: number
}

export type RevenueTotals = {
  salesTotal: number
  refundTotal: number
  netRevenue: number
  cogs: number // giá vốn hàng bán thuần (BR-30)
  grossProfit: number
  marginPct: number // 1 chữ số; 0 khi netRevenue = 0
  orderCount: number
  returnCount: number
}
export type RevenueDay = RevenueTotals & { date: string }
export type RevenueReport = {
  from: string
  to: string
  days: RevenueDay[] // đủ mọi ngày trong khoảng
  totals: RevenueTotals
  previous: {
    from: string
    to: string
    totals: RevenueTotals
    days: { date: string; netRevenue: number; grossProfit: number }[]
  }
}
export type GroupProfitRow = {
  groupId: string
  groupName: string
  color: string
  netRevenue: number
  cogs: number
  grossProfit: number
  marginPct: number
  profitShare: number // % lợi nhuận gộp của nhóm trên tổng, 1 chữ số
}
export type GroupProfitReport = {
  from: string
  to: string
  rows: GroupProfitRow[]
  totals: { netRevenue: number; cogs: number; grossProfit: number; marginPct: number }
}
export type ProductProfitRow = {
  rank: number
  productId: string
  code: string
  name: string
  groupName: string
  baseUnit: string
  quantity: number // số lượng bán thuần theo đơn vị cơ bản (bán − trả)
  netRevenue: number
  cogs: number
  grossProfit: number
  marginPct: number
}
export type ProductProfitQuery = DateRangeQuery & {
  groupId?: string
  sortBy?: ProductSortBy
  page?: number
  pageSize?: number
}
export type ReturnsReport = {
  from: string
  to: string
  returnCount: number
  refundTotal: number
  byReason: { reason: ReturnReason; count: number; refundTotal: number }[]
  defective: {
    quantity: number
    value: number
    rows: {
      productId: string
      code: string
      name: string
      baseUnit: string
      quantity: number
      value: number
    }[]
  }
  writeOffs: { reason: AdjustmentReason; quantity: number; value: number }[] // hàng hủy qua phiếu điều chỉnh giảm (giá trị dương)
}
export type CashierReportRow = {
  cashierId: string
  cashierName: string
  shiftCount: number
  orderCount: number
  netRevenue: number
  returnCount: number
  totalDifference: number // Σ chênh lệch ca đã chốt
}
export type PaymentMethodReportRow = {
  method: PaymentMethod
  amount: number
  orderCount: number
  share: number
}

// ============================================================ Khách hàng P3 (07 §2.11)

export type CustomerDto = {
  id: string
  phone: string // 10 số liền
  name: string
  points: number
  orderCount: number
  totalSpent: number
  lastOrderAt?: string
  createdAt: string
}
export type CreateCustomerRequest = { phone: string; name: string }
export type CustomerQuery = {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

// ============================================================ Thông tin cửa hàng (07 §2.11)

export type StoreProfile = {
  name: string
  address: string
  phone: string
  taxCode?: string
  receiptFooter: string
  returnPolicy: string
  paperSize: ReceiptPaperSize
  bankBin: string
  bankAccount: string
  bankAccountName: string
  allowNegativeStock: boolean
  defaultOpeningCash: number
  logoUrl?: string
}

// ============================================================ Bản ghi mock-db (07 §4.8; chỉ FE dùng)

export type ProductGroupRecord = {
  id: string
  code: string
  name: string
  color: string
  sortOrder: number
  isHidden: boolean
  createdAt: string
}
export type ProductUnitRecord = {
  id: string
  name: string
  factor: number
  barcode?: string | null
  price: number
  sortOrder: number
}
export type ProductRecord = {
  id: string
  code: string
  name: string
  groupId: string
  units: ProductUnitRecord[] // sortOrder 0 là đơn vị cơ bản
  avgCost: number
  stock: number
  minStock: number
  trackExpiry: boolean
  returnable: boolean
  status: ProductStatus
  imageUrl?: string | null
  color: string
  openingStock: number // tồn đầu kỳ của lịch sử mẫu (TonDau); hàng tạo mới là 0
  createdAt: string
  updatedAt?: string | null
}
export type SupplierRecord = {
  id: string
  code: string
  name: string
  phone?: string | null
  address?: string | null
  note?: string | null
  createdAt: string
}
export type GoodsReceiptLineRecord = {
  id: string
  productId: string
  unitId: string
  unitName: string
  factor: number
  quantity: number
  unitPrice: number
  expiryDate?: string | null
  costBefore?: number | null
  costAfter?: number | null
}
export type GoodsReceiptRecord = {
  id: string
  code: string
  supplierId: string
  status: GoodsReceiptStatus
  receivedDate: string
  confirmedAt?: string | null
  createdBy: string // username
  note?: string | null
  lines: GoodsReceiptLineRecord[]
  createdAt: string
}
export type StockAdjustmentRecord = {
  id: string
  code: string
  createdAt: string
  createdBy: string
  reason: AdjustmentReason
  note?: string | null
  goodsReceiptLineId?: string | null
  lines: { productId: string; systemQty: number; actualQty: number; unitCost: number }[]
}
export type ShiftRecord = {
  id: string
  code: string
  cashierId: string
  cashierUsername: string
  cashierName: string
  openedAt: string
  closedAt?: string | null
  openingCash: number
  countedCash?: number | null
  cashCount?: CashCountItem[] | null
  status: ShiftStatus
  note?: string | null
  reviewNote?: string | null
  reviewedByName?: string | null
  reviewedAt?: string | null
}
export type OrderLineRecord = {
  id: string
  productId: string
  productCode: string
  productName: string
  groupId?: string // nhóm chụp lúc bán (07 §3.9); bản ghi cũ thiếu thì lấy nhóm hiện tại
  unitId: string
  unitName: string
  factor: number
  quantity: number
  unitPrice: number
  discount?: DiscountDto | null
  allocatedDiscount: number
  netAmount: number
  unitCost: number
  returnable: boolean
}
export type OrderRecord = {
  id: string
  code: string
  clientRequestId?: string | null
  paidAt: string
  shiftId: string
  cashierId: string
  cashierName: string
  lines: OrderLineRecord[]
  subtotal: number
  orderDiscount?: DiscountDto | null
  total: number
  payments: PaymentDto[]
  approvedByName?: string | null
  customerId?: string | null
  pointsEarned: number
  note?: string | null
  exchangeForReturnId?: string | null
  qrContent?: string | null
}
export type ReturnLineRecord = {
  id: string
  orderLineId: string
  productId: string
  quantity: number
  condition: ReturnCondition
  reason: ReturnReason
  note?: string | null
  refundAmount: number
}
export type ReturnRecord = {
  id: string
  code: string
  clientRequestId?: string | null
  createdAt: string
  shiftId: string
  cashierId: string
  cashierName: string
  orderId: string
  lines: ReturnLineRecord[]
  refundTotal: number
  offsetAmount: number
  refundMethod: RefundMethod
  exchangeOrderId?: string | null
  approvedByName?: string | null
  note?: string | null
  pointsDeducted: number
}
export type CustomerRecord = {
  id: string
  phone: string
  name: string
  points: number
  createdAt: string
}
