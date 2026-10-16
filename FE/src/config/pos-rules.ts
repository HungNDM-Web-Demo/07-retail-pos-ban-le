/**
 * Hằng số nghiệp vụ (docs/06-THIET-KE-CSDL.md §3, docs/07-DANH-SACH-API.md §3). BE khai báo giống hệt ở
 * `Domain/Entities/Pos/PosRules.cs`. Không phải cài đặt: đổi thì sửa SRS trước.
 */
export const posRules = {
  /** BR-04: giá bán là bội số của số này */
  priceStep: 500,
  /** BR-01: hệ số đơn vị quy đổi */
  minFactor: 2,
  maxFactor: 1000,
  /** FR-05 */
  maxConversionUnits: 3,
  /** BR-05: tiền tố n* */
  maxScanPrefix: 999,
  /** Số lượng một dòng giỏ, dòng phiếu nhập */
  maxLineQuantity: 9999,
  /** BR-11 */
  maxHeldTabs: 5,
  /** BR-08: thu ngân tự giảm tối đa (% tổng tiền hàng) */
  cashierDiscountLimitPct: 5,
  /** BR-17 */
  freeReturnDays: 7,
  maxReturnDays: 30,
  /** BR-18 */
  refundApprovalThreshold: 500000,
  /** BR-22 */
  shiftDifferenceThreshold: 20000,
  /** UC-02 2a: hỏi lại khi tiền đầu ca lệch mức mặc định quá số này */
  openingCashWarnDelta: 100000,
  /** BR-25 */
  lowMarginPct: 5,
  /** BR-27 */
  expiryWarningDays: 30,
  /** BR-31 */
  pointValue: 20000,
  /** Xác nhận của chủ cửa hàng hết hạn sau (phút) */
  approvalTtlMinutes: 15,
  /** NFR-02: làm mới danh mục tại máy bán hàng (ms) */
  catalogRefreshMs: 5 * 60 * 1000,
  /** Báo cáo: khoảng ngày tối đa */
  maxReportDays: 366,
  /** BR-03: tiền tố mã vạch nội bộ */
  internalBarcodePrefix: '20',
} as const
