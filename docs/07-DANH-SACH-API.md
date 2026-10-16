# Danh sách API — POS Cửa hàng Bán lẻ

> Base URL dev: `https://localhost:7107` · Swagger: `https://localhost:7107/swagger`
> Demo công khai (chế độ `mock`, không có BE): `https://pum-pos-ban-le.vercel.app`.
> Quy ước chung (đường dẫn, phân trang, lỗi) và API nền (auth, users, roles, settings, audit-logs, demo): xem `ZDOCS/03-KIEN-TRUC/QUY-UOC-API.md`.
> File này là **hợp đồng giữa BE và FE**: BE (`Application/DTOs`) và FE (`FE/src/types/retail-pos.ts`, đã chép đúng các khối `ts` dưới đây) phải khớp từng trường. Ở chế độ `mock`, handler trả đúng các kiểu này, áp đúng công thức §3 và câu lỗi §2.12. Bảng, enum, dữ liệu mẫu: `06-THIET-KE-CSDL.md`.

---

## 1. Mã quyền nghiệp vụ

Đúng `02-SRS.md` §7; mã ghép `create / update / delete` tách thành từng mã. `ADMIN` luôn đủ quyền. Đã khai báo trong `FE/src/mock/seed/project.json` và FE `src/config/permissions.ts`; BE thêm vào `Application/Constants/Permissions.cs`.

| Nhóm | Mã quyền | Tên hiển thị | ADMIN | MANAGER | CASHIER |
| :--- | :--- | :--- | :---: | :---: | :---: |
| Hàng hóa | `products.view` | Xem hàng hóa, giá bán | ✓ | ✓ | ✓ |
| Hàng hóa | `products.create` | Thêm nhóm hàng, mặt hàng, đơn vị quy đổi | ✓ | ✓ | |
| Hàng hóa | `products.update` | Sửa, ẩn nhóm hàng, sửa mặt hàng, giá, in tem | ✓ | ✓ | |
| Hàng hóa | `products.delete` | Xóa mặt hàng chưa có chứng từ | ✓ | ✓ | |
| Hàng hóa | `products.view-cost` | Xem giá vốn, biên lãi | ✓ | ✓ | |
| Bán hàng | `orders.create` | Bán hàng, thanh toán | ✓ | ✓ | ✓ |
| Bán hàng | `orders.view` | Tra cứu hóa đơn (thu ngân chỉ thấy hóa đơn trong ca của mình) | ✓ | ✓ | ✓ |
| Bán hàng | `orders.discount` | Giảm giá trong hạn mức | ✓ | ✓ | ✓ |
| Bán hàng | `orders.discount-override` | Xác nhận giảm vượt hạn mức, bán dưới giá vốn | ✓ | ✓ | |
| Bán hàng | `orders.reprint` | In lại hóa đơn, phiếu đổi trả | ✓ | ✓ | ✓ |
| Đổi trả | `returns.create` | Lập phiếu đổi trả | ✓ | ✓ | ✓ |
| Đổi trả | `returns.view` | Xem phiếu đổi trả (thu ngân chỉ thấy phiếu trong ca của mình) | ✓ | ✓ | ✓ |
| Đổi trả | `returns.override` | Xác nhận trả hàng quá 7 ngày hoặc hoàn trên 500.000 ₫ | ✓ | ✓ | |
| Ca làm | `shifts.operate` | Mở ca, chốt ca của mình | ✓ | ✓ | ✓ |
| Ca làm | `shifts.view` | Xem mọi ca, mọi hóa đơn và phiếu đổi trả | ✓ | ✓ | |
| Ca làm | `shifts.review` | Ghi chú xử lý ca cần kiểm tra | ✓ | ✓ | |
| Tồn kho | `stock-levels.view` | Xem tồn kho, hạn sử dụng, lịch sử biến động | ✓ | ✓ | |
| Tồn kho | `stock-adjustments.create` | Lập phiếu điều chỉnh tồn | ✓ | ✓ | |
| Nhập hàng | `suppliers.view` / `create` / `update` | Xem, thêm, sửa nhà cung cấp | ✓ | ✓ | |
| Nhập hàng | `goods-receipts.view` / `create` / `update` / `delete` | Xem, lập, sửa, xóa phiếu nhập nháp | ✓ | ✓ | |
| Nhập hàng | `goods-receipts.confirm` | Xác nhận nhập kho | ✓ | ✓ | |
| Báo cáo | `reports.view` | Xem tổng quan, báo cáo doanh thu, lợi nhuận | ✓ | ✓ | |
| Khách hàng | `customers.view` / `create` | Tra cứu, thêm nhanh khách | ✓ | ✓ | ✓ |

- **Phạm vi "ca của mình"**: người **không** có `shifts.view` chỉ thấy hóa đơn, phiếu đổi trả thuộc ca do chính mình mở (mọi ngày); tham số `cashierId`, `shiftId` của người khác bị bỏ qua; xem chi tiết chứng từ của người khác → 403. Tra cứu hóa đơn gốc để **đổi trả** (`/api/returns/source*`) không bị giới hạn này, chỉ giới hạn 30 ngày (UC-07 2a).
- **Giá vốn**: người thiếu `products.view-cost` nhận `avgCost`, `marginPct`, `isLowMargin`, `unitCost`, `costAmount`, `costTotal` là `null` (demo: Quản trị viên bỏ quyền này của Chủ cửa hàng, cột giá vốn biến mất).
- Quyền nền `dashboard.view` không dùng: `/dashboard` và `GET /api/reports/dashboard` gắn `reports.view` (§5 quyết định 2).

---

## 2. API nghiệp vụ

Bảng enum dùng chung (chuỗi PascalCase, khớp `06` §4; chữ hiển thị ở `FE/src/config/retail-pos-labels.ts`):

```ts
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
```

Tham số ngày `from`, `to` dạng `yyyy-MM-dd`, hiểu theo giờ Việt Nam (00:00 `from` đến 23:59:59 `to`). Khoảng dài hơn 366 ngày → 400 `errors.from` "Khoảng ngày tối đa 366 ngày"; `to` nhỏ hơn `from` → 400 `errors.to` "Ngày kết thúc phải sau ngày bắt đầu". Danh sách theo quy ước phân trang chung (`page`, `pageSize` ≤ 100, `search`, `sortBy`, `sortDir`). Số tiền là số (Postgres trả `18000.00`, FE dùng như `number`); trường vắng BE trả `null`.

### 2.1. Nhóm hàng — `/api/product-groups`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/product-groups` | `products.view` | Mọi nhóm, theo `sortOrder` → `ProductGroupDto[]` (không phân trang) |
| POST | `/api/product-groups` | `products.create` | → `ProductGroupDto` (201); BE sinh `code` `NH` + 2 số, `sortOrder` = lớn nhất + 10 |
| PUT | `/api/product-groups/{id}` | `products.update` | Đổi tên, màu → `ProductGroupDto` |
| PATCH | `/api/product-groups/{id}/visibility` | `products.update` | `{ isHidden }` → 204 |
| PUT | `/api/product-groups/order` | `products.update` | `{ ids }` đủ mọi nhóm theo thứ tự mới (kéo thả, UC-01 1a) → 204 |

```ts
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
```

Lỗi: tên trống → 400 `errors.name` "Nhập tên nhóm hàng"; tên trùng (so theo `normalizeVi`: bỏ dấu, không phân biệt hoa thường) → 409 `errors.name` "Tên nhóm hàng đã tồn tại"; `ids` thiếu hoặc thừa nhóm → 400 "Danh sách nhóm không đầy đủ". Không có API xóa nhóm (FR-03 chỉ ẩn).

### 2.2. Hàng hóa — `/api/products`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/products?page&pageSize&search&groupId&status&stockStatus&lowMargin&sortBy&sortDir` | `products.view` | FR-06. `search` tìm `NameSearch` (không dấu), mã hàng, mã vạch mọi đơn vị (khớp đúng). Mặc định `sortBy=code asc` → `PaginatedResult<ProductDto>` |
| GET | `/api/products/{id}` | `products.view` | → `ProductDto` |
| GET | `/api/products/lookup?barcode=` | `products.view` | Quét mã ở phiếu nhập, điều chỉnh → `ProductLookupDto` (mặt hàng và đơn vị khớp mã); không thấy → 404 "Không tìm thấy mã vạch {mã}" |
| POST | `/api/products` | `products.create` | → `ProductDto` (201), sinh `SP` + 5 số, tồn 0, giá vốn = `initialCost` (vắng là 0) |
| PUT | `/api/products/{id}` | `products.update` | Thay thông tin và bộ đơn vị quy đổi (đơn vị vắng trong request thì xóa, nếu chưa `everUsed`) → `ProductDto` |
| PATCH | `/api/products/{id}/status` | `products.update` | `{ status }` Đang bán ↔ Ngừng bán → 204 |
| PATCH | `/api/products/{id}/prices` | `products.update` | Sửa nhanh giá sau nhập kho (UC-14 bước 6) → `ProductDto` |
| DELETE | `/api/products/{id}` | `products.delete` | Xóa mềm khi `hasDocuments = false` → 204 |
| POST | `/api/products/internal-barcode` | `products.create` hoặc `products.update` | Cấp mã nội bộ kế tiếp (BR-03, FR-07) → `InternalBarcodeDto`; không giữ chỗ, trùng khi lưu thì báo như mã trùng |

```ts
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
```

Kiểm tra khi lưu (thứ tự, câu lỗi đúng chữ; key lỗi theo `QUY-UOC-API` §1.3, đơn vị quy đổi `units[i].…` theo chỉ số trong request):

| Tình huống | HTTP, key | Câu |
| :--- | :--- | :--- |
| Tên trống | 400 `name` | "Nhập tên mặt hàng" |
| Đơn vị cơ bản trống | 400 `baseUnit` | "Nhập đơn vị cơ bản" |
| Mã vạch không phải 8–14 chữ số | 400 `barcode` / `units[i].barcode` | "Mã vạch gồm 8 đến 14 chữ số" |
| Giá ≤ 0 hoặc không bội số 500 (kiểm sau các lỗi trường trên) | 400 `price` / `units[i].price`, `code: "GiaKhongHopLe"` | "Giá phải là bội số của 500 ₫" (TC-03) |
| Hệ số không nguyên, < 2 hoặc > 1.000 | 400 `units[i].factor`, `code: "DonViQuyDoiKhongHopLe"` | "Hệ số là số nguyên từ 2 đến 1.000" |
| Quá 3 đơn vị quy đổi | 400 `units`, `code: "DonViQuyDoiKhongHopLe"` | "Tối đa 3 đơn vị quy đổi" |
| Tên đơn vị trùng trong mặt hàng | 400 `units[i].name` | "Tên đơn vị bị trùng" |
| Mã vạch trùng (mọi đơn vị, mọi mặt hàng, kể cả trong chính request) | 409 `barcode` / `units[i].barcode`, `code: "MaVachDaDung"` | "Mã đã dùng cho {tên mặt hàng} – {tên đơn vị}" (TC-02: "Mã đã dùng cho Bia lager lon 330ml – Lốc 6") |
| Xóa hoặc đổi hệ số đơn vị `everUsed` | 400 `units[i].factor`, `code: "DonViDaDung"` | "Đơn vị {tên} đã có trong chứng từ, không xóa, không đổi hệ số" |
| Xóa mặt hàng đã có chứng từ | 400 `code: "HangDaCoChungTu"` | "Mặt hàng đã có chứng từ, không xóa được. Chuyển sang Ngừng bán" (TC-04) |

Cảnh báo BR-04 "Mua theo đơn vị lớn đắt hơn mua lẻ" (giá đơn vị > giá cơ bản × hệ số) **không** là lỗi: FE hiện dưới ô giá kèm "Giá tham khảo {giá cơ bản × hệ số}" (TC-03: 432.000 ₫), BE vẫn lưu.

### 2.3. Danh mục cho máy bán hàng — `/api/pos/catalog`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/pos/catalog` | `orders.create` | Toàn bộ hàng hóa, đơn vị, giá, tồn (không có giá vốn) → `PosCatalog`. Hỗ trợ `ETag` = `version`: `If-None-Match` trùng → 304 |

```ts
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
```

`version` = băm của (lần sửa hàng hóa mới nhất, `Σ Version` của hàng hóa). FE nạp khi mở ca, làm mới mỗi 5 phút và ngay sau mỗi lần thanh toán, đổi trả của chính máy (NFR-02). Quét, tìm tên, kiểm tra giá (F3), đọc tồn quy đổi, cảnh báo vượt tồn đều chạy trên danh mục này tại máy, không gọi API.

### 2.4. Bán hàng, hóa đơn — `/api/orders`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| POST | `/api/orders/quote` | `orders.create` | Tính tiền giỏ theo giá, giá vốn hiện tại, cho biết cần xác nhận không (UC-05 bước 3) → `OrderQuote`. Không lưu gì. FE gọi khi áp giảm giá và khi mở hộp thanh toán |
| POST | `/api/orders` | `orders.create` | **Thanh toán** (UC-06): kiểm tra ca, tính lại tiền, xác nhận, tiền khách đưa; tạo hóa đơn, trừ tồn, chụp giá vốn, ghi biến động tồn, cộng điểm → `OrderDto` (201). Cùng `clientRequestId` gửi lại → `OrderDto` cũ với **200** (TC-29) |
| GET | `/api/orders?page&pageSize&search&from&to&cashierId&shiftId&paymentMethod&returnStatus&customerId` | `orders.view` | FR-21. `search` theo mã hoặc ghi chú. Mặc định `sortBy=paidAt desc`. Phạm vi theo §1 → `PaginatedResult<OrderListItem>` |
| GET | `/api/orders/{id}` | `orders.view` | → `OrderDto`, kèm phiếu đổi trả liên quan |
| GET | `/api/orders/by-code/{code}` | `orders.view` | Quét mã trên bill để mở hóa đơn → `OrderDto`; không thấy → 404 "Không tìm thấy hóa đơn {mã}" |
| GET | `/api/orders/next-code` | `orders.create` | Mã hóa đơn dự kiến cho nội dung QR (UC-06 2a) → `NextCodeDto`; mã thật gán lúc lưu, có thể khác nếu quầy khác thanh toán trước |

```ts
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
```

Thanh toán chạy theo thứ tự (dừng ở lỗi đầu tiên; câu lỗi ở §2.12):

1. Đã có hóa đơn cùng `clientRequestId` → trả 200 hóa đơn đó.
2. Người gọi có ca `DangMo` (`ChuaMoCa`).
3. Giỏ ≥ 1 dòng (`GioTrong`); mỗi dòng: hàng tồn tại, `DangBan` (`HangNgungBan`), `unitId` thuộc hàng (`DonViKhongHopLe`), số lượng 1–9.999 (`SoLuongKhongHopLe`).
4. Tính tiền §3.1–3.3; giảm số tiền > phần được giảm → `GiamQuaTongTien`; `reason = Khac` thiếu `note` → 400 `errors["orderDiscount.note"]` "Nhập ghi chú lý do giảm giá".
5. `Pos.AllowNegativeStock = false` và có hàng vượt tồn (BR-10) → `VuotTon` kèm `overStock`.
6. Cần xác nhận (§3.4) mà thiếu `approvalToken` hợp lệ cho hành động `GiamGia` → `CanXacNhan` kèm `approvalReasons`; token sai, hết hạn, đã dùng → `MaXacNhanKhongHopLe`.
7. `expectedTotal` ≠ tổng tính được → 409 `TongTienDaDoi` kèm `serverTotal`.
8. Tiền mặt: `cashReceived` < tổng → `TienKhongDu`.
9. Ghi hóa đơn (mã BR-16), dòng (chụp giá, `UnitCost` = giá vốn bình quân hiện tại, BR-13), khoản thu, trừ tồn, biến động `BanHang`, điểm khách (BR-31), đánh dấu `EverUsed`, tiêu token xác nhận; tất cả trong một transaction.

### 2.5. Xác nhận của chủ cửa hàng — `/api/approvals`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| POST | `/api/approvals` | `orders.discount` (khi `action = GiamGia`) hoặc `returns.create` (khi `DoiTra`) | Chủ cửa hàng gõ tài khoản ngay trên máy bán hàng (FR-16, FR-25) → `ApprovalDto` (201) |

```ts
export type ApprovalRequest = { username: string; password: string; action: ApprovalAction }
export type ApprovalDto = {
  token: string // dùng một lần, hết hạn sau 15 phút
  action: ApprovalAction
  approvedById: string
  approvedByName: string // tên đăng nhập, vd "quanly"
  expiresAt: string
}
```

BE kiểm tra mật khẩu như đăng nhập nhưng **không** tạo phiên, không ghi `LastLoginAt`, vẫn đếm sai mật khẩu (BR-SYS-03). Sai tên hoặc mật khẩu → **400** `SaiTaiKhoanXacNhan` (không dùng 401 để `lib/axios.ts` không làm mới token của thu ngân). Tài khoản bị khóa → 400 "Tài khoản đã bị khóa, liên hệ quản trị viên". Đúng tài khoản nhưng thiếu `orders.discount-override` (GiamGia) hoặc `returns.override` (DoiTra) → **403** `KhongCoQuyenXacNhan` (TC-24). Token lưu `IMemoryCache` 15 phút, dùng một lần, gắn với `action`. Mock: kiểm mật khẩu demo và quyền của tài khoản trong mock-db, token giữ trong biến module của tab.

### 2.6. Đổi trả — `/api/returns`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/returns/source?code=` | `returns.create` | Mở hóa đơn gốc bằng mã quét trên bill hoặc gõ tay (FR-22) → `ReturnSourceOrder` |
| GET | `/api/returns/source-orders?date&productId&search&page&pageSize` | `returns.create` | "Tìm hóa đơn" khi khách mất bill (UC-07 2a): chỉ hóa đơn trong 30 ngày, chưa trả hết, lọc ngày mua và mặt hàng → `PaginatedResult<ReturnSourceListItem>` |
| POST | `/api/returns` | `returns.create` | Lập phiếu (kèm hóa đơn đổi hàng nếu có) → `ReturnDto` (201); cùng `clientRequestId` → 200 phiếu cũ |
| GET | `/api/returns?page&pageSize&search&from&to&cashierId&shiftId` | `returns.view` | Phạm vi theo §1, mặc định `sortBy=createdAt desc` → `PaginatedResult<ReturnListItem>` |
| GET | `/api/returns/{id}` | `returns.view` | → `ReturnDto` (bản in phiếu đổi trả) |

```ts
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
```

Lập phiếu chạy theo thứ tự: trùng `clientRequestId` → 200; có ca mở (`ChuaMoCa`); hóa đơn gốc tồn tại (`KhongThayHoaDon`), ≤ 30 ngày (`QuaHanDoiTra`), chưa trả hết (`DaTraHet`); mỗi dòng trả: thuộc hóa đơn, `returnable` (`HangKhongDoiTra`), 1 ≤ số lượng ≤ còn trả được (`VuotSoLuongTra`, `errors["lines[i].quantity"]` "Tối đa {n}"), `reason = Khac` thì có `note`; tính tiền hoàn §3.6; cần xác nhận (ngày 8–30 hoặc hoàn > 500.000 ₫) mà thiếu token `DoiTra` hợp lệ → `CanXacNhan`; `expectedRefundTotal` lệch → 409 `TongTienDaDoi`; hàng đổi: kiểm như thanh toán §2.4 bước 3–5, 7 (với `exchange.expectedTotal`), chênh lệch dương thì bắt buộc `exchange.payment` và kiểm tiền khách đưa với **phần chênh lệch**; ghi phiếu, dòng, hóa đơn đổi (mã `HD` mới, khoản thu `BuTruDoiHang` + phần còn lại), cộng tồn dòng `BanLaiDuoc` (biến động `TraHang`, BR-19, giá vốn tính lại §3.8), cập nhật `ReturnedQty`, `RefundedAmount`, `ReturnStatus` của hóa đơn gốc, trừ điểm khách.

Hàng đổi không áp giảm giá, không gắn khách khác hóa đơn gốc (§5 quyết định 13).

### 2.7. Ca làm — `/api/shifts`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/shifts/current` | `shifts.operate` | Ca `DangMo` của người gọi, số tổng hợp tính tới lúc gọi → `ShiftDto`; chưa có → **204** (FE hiện hộp Mở ca, TC-05, TC-06) |
| POST | `/api/shifts` | `shifts.operate` | Mở ca `OpenShiftRequest` → `ShiftDto` (201). Đã có ca mở → trả ca đó với **200** (UC-02 E2) |
| POST | `/api/shifts/current/close` | `shifts.operate` | Chốt ca `CloseShiftRequest` → `ShiftDto` (UC-09) |
| GET | `/api/shifts?page&pageSize&from&to&cashierId&status` | `shifts.view` | FR-29. FE mặc định 7 ngày gần nhất; `sortBy=openedAt desc` → `PaginatedResult<ShiftDto>` |
| GET | `/api/shifts/{id}` | `shifts.view` hoặc ca của mình | → `ShiftDetail` (bản in báo cáo ca, chi tiết ca) |
| PATCH | `/api/shifts/{id}/review` | `shifts.review` | `ReviewShiftRequest` → **200** `ShiftDto` (TC-11) |

```ts
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
```

Lỗi: `openingCash` trống hoặc âm → 400 `errors.openingCash` "Nhập tiền đầu ca"; chốt khi không có ca mở → 400 `ChuaMoCa` "Chưa mở ca"; `cashCount` có mệnh giá ngoài danh sách hoặc số tờ âm → 400 `errors.cashCount` "Số tờ không hợp lệ"; lệch quá 20.000 ₫ mà `note` trống → 400 `CanGhiChu` `errors.note` "Chênh lệch quá 20.000 ₫, cần ghi chú" (TC-08); review ca không ở `CanKiemTra` → 400 `CaKhongCanKiemTra`; review thiếu `note` → 400 `errors.note` "Nhập ghi chú xử lý". Hóa đơn chờ nằm trên trình duyệt nên kiểm tra BR-11 khi chốt ca do FE làm (TC-10, §4.5).

### 2.8. Tồn kho — `/api/stock`, `/api/stock-adjustments`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/stock?page&pageSize&search&groupId&status&includeInactive&sortBy&sortDir` | `stock-levels.view` | FR-30, mặc định `sortBy=code asc` → `PaginatedResult<StockItem>` |
| GET | `/api/stock/summary?groupId&status&includeInactive` | `stock-levels.view` | Dòng tổng giá trị tồn và đếm trạng thái → `StockSummary` |
| GET | `/api/stock/lots?status&productId` | `stock-levels.view` | Tab Sắp hết hạn (FR-31): mặc định trả `SapHetHan` và `DaHetHan`; có `productId` mà không có `status` thì mọi lô còn hàng; hạn gần nhất trước → `StockLotDto[]` |
| GET | `/api/stock/{productId}/movements?page&pageSize` | `stock-levels.view` | FR-32, mới nhất trước → `PaginatedResult<StockMovementDto>` |
| GET | `/api/stock-adjustments?page&pageSize&search&from&to&reason` | `stock-levels.view` | → `PaginatedResult<StockAdjustmentListItem>` |
| GET | `/api/stock-adjustments/{id}` | `stock-levels.view` | → `StockAdjustmentDto` |
| POST | `/api/stock-adjustments` | `stock-adjustments.create` | Lưu là áp dụng ngay (BR-28) → `StockAdjustmentDto` (201) |

```ts
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
```

Lỗi điều chỉnh: không có dòng → 400 `errors.lines` "Thêm ít nhất một mặt hàng"; `actualQty` âm → 400 `errors["lines[i].actualQty"]` "Số lượng thực tế không âm"; mặt hàng trùng trong phiếu → 400 "Mặt hàng bị trùng"; `reason = Khac` thiếu `note` → 400 `errors.note` "Nhập ghi chú". Dòng có `actualQty` bằng tồn hệ thống được bỏ qua; phiếu chỉ còn dòng chênh 0 → 400 "Không có chênh lệch để điều chỉnh".

### 2.9. Nhà cung cấp, phiếu nhập — `/api/suppliers`, `/api/goods-receipts`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/suppliers?page&pageSize&search` | `suppliers.view` | → `PaginatedResult<SupplierDto>` (ô chọn dùng `pageSize=100`) |
| GET | `/api/suppliers/{id}` | `suppliers.view` | → `SupplierDto` |
| POST | `/api/suppliers` | `suppliers.create` | Thêm, kể cả thêm nhanh trong form phiếu nhập → `SupplierDto` (201) |
| PUT | `/api/suppliers/{id}` | `suppliers.update` | → `SupplierDto` |
| GET | `/api/goods-receipts?page&pageSize&search&status&supplierId&from&to` | `goods-receipts.view` | Mặc định `sortBy=createdAt desc` → `PaginatedResult<GoodsReceiptListItem>` |
| GET | `/api/goods-receipts/{id}` | `goods-receipts.view` | → `GoodsReceiptDto` |
| POST | `/api/goods-receipts` | `goods-receipts.create` | Lưu nháp → `GoodsReceiptDto` (201) |
| PUT | `/api/goods-receipts/{id}` | `goods-receipts.update` | Sửa nháp → `GoodsReceiptDto` |
| DELETE | `/api/goods-receipts/{id}` | `goods-receipts.delete` | Xóa nháp → 204 |
| POST | `/api/goods-receipts/{id}/confirm` | `goods-receipts.confirm` | Xác nhận nhập kho (FR-35) → `ConfirmGoodsReceiptResult` |

```ts
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
```

Lỗi: tên NCC trống → 400 `errors.name` "Nhập tên nhà cung cấp"; SĐT sai → 400 `errors.phone` "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0"; phiếu không có dòng → 400 `errors.lines` "Thêm ít nhất một mặt hàng"; số lượng ≤ 0 → 400 `errors["lines[i].quantity"]` "Số lượng lớn hơn 0"; đơn giá âm → 400 `errors["lines[i].unitPrice"]` "Đơn giá không âm"; sửa, xóa, xác nhận phiếu `DaNhapKho` → 400 `PhieuDaNhapKho` "Phiếu đã nhập kho, không sửa, không xóa" (TC-41); xác nhận khi hàng có HSD thiếu `expiryDate` → 400 `ThieuHanSuDung` `errors["lines[i].expiryDate"]` "Nhập hạn sử dụng"; HSD không sau ngày nhập → cùng key "Hạn sử dụng phải sau ngày nhập". Lưu nháp **không** bắt HSD. FE "Xác nhận nhập kho" ở phiếu chưa lưu thì gọi `POST` (hoặc `PUT`) rồi `confirm`.

Xác nhận: lần lượt từng dòng theo `lineNo`, tính giá vốn BR-23 (§3.8), ghi `CostBefore`, `CostAfter`, tăng tồn, biến động `NhapHang`, `EverUsed`; `lowMarginProducts` = mặt hàng trong phiếu có biên lãi sau nhập < 5% (TC-40), mỗi mặt hàng một dòng.

### 2.10. Báo cáo — `/api/reports`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/reports/dashboard` | `reports.view` | Tổng quan (FR-01, FR-02) → `DashboardDto` |
| GET | `/api/reports/revenue?from&to` | `reports.view` | Doanh thu, lợi nhuận theo ngày, so kỳ trước cùng độ dài (FR-36) → `RevenueReport` |
| GET | `/api/reports/groups?from&to` | `reports.view` | Theo nhóm hàng (FR-37) → `GroupProfitReport` |
| GET | `/api/reports/products?from&to&groupId&sortBy&page&pageSize` | `reports.view` | Theo mặt hàng, xếp hạng theo `sortBy` (mặc định `grossProfit`) giảm dần → `PaginatedResult<ProductProfitRow>` |
| GET | `/api/reports/returns?from&to&reason` | `reports.view` | Đổi trả và hàng lỗi (FR-38) → `ReturnsReport` |
| GET | `/api/reports/cashiers?from&to` | `reports.view` | Theo thu ngân → `CashierReportRow[]` |
| GET | `/api/reports/payment-methods?from&to` | `reports.view` | Theo phương thức → `PaymentMethodReportRow[]` |

```ts
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
  byReason: { reason: ReturnReason; count: number; refundTotal: number }[] // count = số phiếu có dòng lý do đó
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
```

Công thức §3.9. Xuất Excel (FR-39, P3) làm ở FE từ DTO đang xem (gói `write-excel-file`).

### 2.11. Khách hàng (P3), thông tin cửa hàng

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/customers?page&pageSize&search` | `customers.view` | → `PaginatedResult<CustomerDto>` |
| GET | `/api/customers/by-phone/{phone}` | `customers.view` | F4 ở màn bán hàng → `CustomerDto`; không thấy → 404 "Chưa có khách với số {SĐT}" |
| GET | `/api/customers/{id}` | `customers.view` | → `CustomerDto` |
| GET | `/api/customers/{id}/orders?page&pageSize` | `customers.view` | Lịch sử mua → `PaginatedResult<OrderListItem>` (không giới hạn phạm vi ca) |
| POST | `/api/customers` | `customers.create` | Thêm nhanh → `CustomerDto` (201); SĐT trùng → 409 `errors.phone` "Số điện thoại đã có khách" |
| GET | `/api/store-profile` | Đã đăng nhập | Thông tin in hóa đơn, QR, cài đặt bán hàng (đọc `Store.*`, `Pos.*`, `Brand.LogoUrl`) → `StoreProfile` |

```ts
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
```

```ts
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
```

Sửa thông tin cửa hàng, khổ in, bán âm kho, tiền đầu ca mặc định bằng `PUT /api/settings` của nền (Cài đặt chung, nhóm "Cửa hàng", "Bán hàng"); BE kiểm như `FE/src/config/setting-labels.ts`.

### 2.12. Bảng mã lỗi nghiệp vụ

Lỗi nghiệp vụ trả ProblemDetails có thêm trường `code` (bảng dưới) và trường mở rộng nếu có; `detail` đúng chữ để FE hiện thẳng. Mock dùng `domain(detail, { code, … })`, `conflict`, `notFound`, `forbidden` của `mock-errors.ts`.

| `code` | HTTP | `detail` | Mở rộng, ghi chú |
| :--- | :---: | :--- | :--- |
| `ChuaMoCa` | 400 | "Chưa mở ca, mở ca trước khi bán hàng" (lập phiếu đổi trả: "Mở ca trước khi đổi trả") | BR-21, TC-06 |
| `GioTrong` | 400 | "Hóa đơn chưa có hàng" | `errors.lines` |
| `HangNgungBan` | 400 | "Hàng ngừng bán: {tên}" | `errors["lines[i].productId"]` |
| `DonViKhongHopLe` | 400 | "Đơn vị không còn bán, tải lại danh mục" | |
| `SoLuongKhongHopLe` | 400 | "Số lượng từ 1 đến 9.999" | `errors["lines[i].quantity"]` |
| `VuotTon` | 400 | "Vượt tồn {n} {đơn vị cơ bản}: {tên}" (dòng đầu) | `overStock: OverStockLine[]`; chỉ khi tắt bán âm kho |
| `GiamQuaTongTien` | 400 | "Số tiền giảm lớn hơn tổng tiền hàng" | UC-05 E1; `errors["orderDiscount.value"]` hoặc `errors["lines[i].discount.value"]` |
| `CanXacNhan` | 400 | "Cần chủ cửa hàng xác nhận: {lý do 1}; {lý do 2}" | `approvalReasons: ApprovalReason[]` |
| `MaXacNhanKhongHopLe` | 400 | "Xác nhận của chủ cửa hàng không hợp lệ hoặc đã hết hạn, xác nhận lại" | |
| `TienKhongDu` | 400 | "Còn thiếu {số tiền}" | `errors["payment.cashReceived"]`, TC-26 "Còn thiếu 4.500 ₫" |
| `TongTienDaDoi` | 409 | "Tổng tiền đã thay đổi (giá hoặc giảm giá), kiểm tra lại hóa đơn" | `serverTotal`; FE gọi lại quote, hiện tổng mới, cho bấm lại |
| `KhongThayHoaDon` | 404 | "Không tìm thấy hóa đơn {mã}" | UC-07 E4 |
| `QuaHanDoiTra` | 400 | "Hóa đơn đã quá 30 ngày, không nhận đổi trả" | TC-34 |
| `DaTraHet` | 400 | "Hóa đơn {mã} đã trả hết" | UC-07 E4 |
| `HangKhongDoiTra` | 400 | "Hàng không đổi trả" | TC-33 |
| `VuotSoLuongTra` | 400 | "Tối đa {n}" | `errors["lines[i].quantity"]`, TC-36 |
| `MaVachDaDung` | 409 | "Mã đã dùng cho {tên mặt hàng} – {tên đơn vị}" | TC-02 |
| `GiaKhongHopLe` | 400 | "Giá phải là bội số của 500 ₫" | TC-03 |
| `DonViQuyDoiKhongHopLe` | 400 | "Hệ số là số nguyên từ 2 đến 1.000" hoặc "Tối đa 3 đơn vị quy đổi" | |
| `HangDaCoChungTu` | 400 | "Mặt hàng đã có chứng từ, không xóa được. Chuyển sang Ngừng bán" | TC-04 |
| `DonViDaDung` | 400 | "Đơn vị {tên} đã có trong chứng từ, không xóa, không đổi hệ số" | BR-29 |
| `PhieuDaNhapKho` | 400 | "Phiếu đã nhập kho, không sửa, không xóa" | TC-41 |
| `ThieuHanSuDung` | 400 | "Nhập hạn sử dụng" / "Hạn sử dụng phải sau ngày nhập" | `errors["lines[i].expiryDate"]` |
| `CaKhongCanKiemTra` | 400 | "Chỉ ghi chú xử lý cho ca Cần kiểm tra" | |
| `CanGhiChu` | 400 | "Chênh lệch quá 20.000 ₫, cần ghi chú" | `errors.note`, TC-08 |
| `SaiTaiKhoanXacNhan` | 400 | "Tên đăng nhập hoặc mật khẩu không đúng" | |
| `KhongCoQuyenXacNhan` | 403 | "Tài khoản không có quyền xác nhận giảm giá" / "Tài khoản không có quyền xác nhận đổi trả" | TC-24 |

Câu chỉ có ở FE (không có API tương ứng), viết đúng chữ:

| Tình huống | Câu |
| :--- | :--- |
| Quét mã không có trong danh mục (TC-15) | "Không tìm thấy mã vạch {mã}" |
| Quét mã hàng ngừng bán (TC-04, UC-03 E2) | "Hàng ngừng bán" |
| Tiền tố `n*` sai: 0, > 999, có chữ (UC-03 E5) | "Số lượng trước dấu * từ 1 đến 999" |
| F6 khi đã đủ 5 tab (TC-18) | "Tối đa 5 hóa đơn chờ" |
| Dòng vượt tồn (BR-10, TC-19) | "Vượt tồn {n} {đơn vị cơ bản}", vd "Vượt tồn 1 hộp" |
| Tiền khách đưa thiếu (TC-26) | "Còn thiếu {số tiền}" |
| Thanh toán tiền mặt xong (FR-17) | "Đã mở két" |
| Chưa lưu được hóa đơn do mất mạng (UC-06 E2) | "Chưa lưu được hóa đơn, thử lại" |
| Chốt ca còn hóa đơn chờ có hàng (TC-10) | "Còn {n} hóa đơn chờ, thanh toán hoặc xóa trước khi chốt ca" |
| Tiền đầu ca lệch mặc định > 100.000 ₫ (UC-02 2a) | "Tiền đầu ca khác mức thường ngày, xác nhận?" |
| Hoàn tiền mặt > tiền mặt lý thuyết của ca (UC-07 E5) | "Tiền mặt trong két có thể không đủ, nên hoàn bằng chuyển khoản" |
| Màn đổi trả khi chưa mở ca (TC-06) | Nút "Tạo phiếu đổi trả" khóa, chú thích "Mở ca trước khi đổi trả" |
| Hóa đơn cần xác nhận đổi trả (TC-34) | "Hóa đơn {n} ngày, cần chủ cửa hàng xác nhận" |
| Tiền hoàn lớn (TC-35) | "Tiền hoàn trên 500.000 ₫, cần chủ cửa hàng xác nhận" |
| Giỏ đổi sau khi đã duyệt giảm giá (UC-05 E3) | "Hóa đơn đã thay đổi, giảm giá cần xác nhận lại" |

---

## 3. Công thức và quy tắc (nguồn sự thật chung của BE, FE và mock)

Tiền là số nguyên đồng. `floor500(x)` = làm tròn xuống tới bội số 500. `round1(x)` = làm tròn tới 1 ₫, nửa lên (C# `MidpointRounding.AwayFromZero`, JS `Math.round` với số dương). BE đặt trong `Domain/Entities/Pos/OrderPricing.cs`, `StockMath.cs`; FE trong `features/pos/lib/pricing.ts`, `stock-math.ts`.

### 3.1. Dòng và giảm giá (BR-06, BR-07)

- `amount = unitPrice × quantity` (giá của đơn vị trên dòng). Đổi đơn vị giữ số lượng, lấy giá đơn vị mới.
- Giảm dòng: `PhanTram` → `floor500(amount × value ÷ 100)`; `SoTien` → `value` (bội số 500, ≤ `amount`, vượt → `GiamQuaTongTien`).
- `afterLine = subtotal − lineDiscountTotal`. Giảm hóa đơn: `PhanTram` → `floor500(afterLine × value ÷ 100)`; `SoTien` → `value` (≤ `afterLine`).
- `total = afterLine − orderDiscountAmount` (≥ 0). `discountTotal = lineDiscountTotal + orderDiscountAmount`.

### 3.2. Phân bổ giảm giá hóa đơn (BR-14)

Cơ sở mỗi dòng `b_i = amount_i − discountAmount_i`. Dòng 1…n−1: `allocated_i = round1(orderDiscountAmount × b_i ÷ afterLine)`; dòng cuối (theo `lineNo`) nhận phần còn lại. `netAmount_i = b_i − allocated_i`; Σ `netAmount` = `total`.

### 3.3. Giá vốn dòng, gộp dòng (BR-05, BR-13)

- `baseQty = quantity × factor`; `unitCost` = giá vốn bình quân hiện tại lúc thanh toán; `costAmount = baseQty × unitCost`; `costTotal = Σ costAmount`.
- Quét lại cùng mặt hàng, cùng đơn vị, dòng **chưa có giảm dòng** → cộng số lượng; dòng đã có giảm dòng → thêm dòng mới.

### 3.4. Cần chủ cửa hàng xác nhận (BR-08, BR-09)

- `discountPct = discountTotal ÷ subtotal × 100`. **`discountPct > 5`** (so giá trị chưa làm tròn) → lý do `VuotHanMuc`: "Giảm {discountPct làm tròn 1 chữ số, dấu phẩy}%, vượt hạn mức 5%".
- `expectedCost = Σ baseQty × giá vốn bình quân hiện tại`. **`total < expectedCost`** (xét mọi hóa đơn, kể cả không giảm giá) → lý do `DuoiGiaVon`: "Thấp hơn giá vốn {expectedCost − total}" (định dạng `formatVnd`).
- Có lý do nào → `needsApproval`. Token `GiamGia` do chủ cửa hàng cấp; thanh toán ghi `ApprovedByName` và `ApprovalReasons`.
- FE giữ lý do lúc duyệt; giỏ đổi (thêm, bớt, sửa) thì gọi lại quote: tập mã lý do khác lúc duyệt → gỡ giảm giá, báo "Hóa đơn đã thay đổi, giảm giá cần xác nhận lại" (UC-05 E3); vẫn cùng tập mã → giữ token.

### 3.5. Tiền mặt, điểm (BR-12, BR-31)

- Mức gợi ý: `[total, ⌈total/10.000⌉×10.000, ⌈total/50.000⌉×50.000, ⌈total/100.000⌉×100.000, ⌈total/500.000⌉×500.000]`, bỏ trùng, giữ thứ tự tăng.
- `changeAmount = cashReceived − total` (hóa đơn đổi hàng: trừ phần phải thu thêm). Thiếu → `TienKhongDu` "Còn thiếu {total − cashReceived}".
- `pointsEarned = ⌊total ÷ 20.000⌋` khi có khách; trả hàng trừ `⌊refundTotal ÷ 20.000⌋`, điểm không âm.

### 3.6. Đổi trả (BR-17, BR-18, BR-20)

- `daysSince` = số ngày lịch (giờ Việt Nam) từ ngày mua tới hôm nay. 0–7: tự xử lý; 8–30: cần xác nhận "Hóa đơn {daysSince} ngày, cần chủ cửa hàng xác nhận"; > 30: `QuaHanDoiTra`.
- Tiền hoàn dòng: trả hết phần còn lại (`returnedQty + q = quantity`) → `netAmount − refundedAmount`; còn lại → `floor500(netAmount × q ÷ quantity)`. `refundTotal = Σ`. `refundTotal > 500.000` → cần xác nhận "Tiền hoàn trên 500.000 ₫, cần chủ cửa hàng xác nhận".
- Đổi hàng: `exchangeTotal` tính như hóa đơn không giảm giá. `difference = exchangeTotal − refundTotal`. `offsetAmount = min(refundTotal, exchangeTotal)`; `payoutAmount = refundTotal − offsetAmount` trả bằng `refundMethod`; hóa đơn đổi có khoản `BuTruDoiHang = offsetAmount` cộng khoản phương thức khách chọn cho `difference` khi dương.
- Giá vốn hàng trả: `costAmount = baseQty × unitCost` của dòng gốc (mọi tình trạng, dùng cho báo cáo); hàng lỗi có giá trị bằng số này.

### 3.7. Ca (BR-21, BR-22)

- `salesByMethod[m] = Σ PaymentDto.amount` của hóa đơn trong ca theo phương thức (tiền mặt đã trừ tiền thối). `refundByMethod`: `payoutAmount` theo `refundMethod`, `offsetAmount` vào `BuTruDoiHang`.
- **`expectedCash = openingCash + salesByMethod.TienMat − refundByMethod.TienMat`**. `difference = countedCash − expectedCash`; `|difference| > 20.000` → `CanKiemTra` (bắt ghi chú), ngược lại `DaChot`.
- `countedCash = Σ denomination × count`, mệnh giá 500.000 / 200.000 / 100.000 / 50.000 / 20.000 / 10.000 / 5.000 / 2.000 / 1.000 / 500.

### 3.8. Tồn, giá vốn, lô (BR-02, BR-19, BR-23, BR-25…BR-28)

- **Giá vốn nhập** (BR-23): mỗi dòng nhập theo `lineNo`: `u = unitPrice ÷ factor` (không làm tròn), `qIn = quantity × factor`; tồn hiện tại `s ≤ 0` → `cost' = round1(u)`; ngược lại `cost' = round1((s × cost + qIn × u) ÷ (s + qIn))`; rồi `s += qIn`.
- **Trả hàng bán lại được** (BR-19): như một dòng nhập với `u = unitCost` dòng gốc, `qIn = baseQty`.
- Bán, điều chỉnh không đổi giá vốn.
- **Biên lãi** (BR-25): `marginPct = round((price − avgCost) ÷ price × 100, 1 chữ số)`; `isLowMargin = marginPct < 5`.
- **Trạng thái** (BR-26): `AmKho` < 0, `HetHang` = 0, `SapHet` ≤ `minStock`, còn lại `ConHang`.
- **Vượt tồn** (BR-10): `shortage = Σ baseQty của mặt hàng trong giỏ − max(tồn, 0)`, dòng nào `shortage > 0` vào `overStock`.
- **Đọc tồn quy đổi** (BR-02): tồn > 0: chia lần lượt cho đơn vị hệ số lớn → nhỏ, lấy phần nguyên, bỏ phần bằng 0, nối bằng dấu cách: "{số} {từ đầu tiên của tên đơn vị, chữ thường}". Tồn = 0 → "0 {đơn vị cơ bản}"; tồn < 0 → "−{|tồn|} {đơn vị cơ bản}" (dấu trừ U+2212).
- **Lô** (BR-27): lô của mặt hàng sắp theo ngày nhập (rồi giờ xác nhận, `lineNo`) mới → cũ; `left = max(tồn, 0)`; mỗi lô nhận `min(left, receivedQty)`. `daysLeft = expiryDate − hôm nay` (ngày lịch); `remaining > 0` và `daysLeft < 0` → `DaHetHan`; `remaining > 0` và `daysLeft ≤ 30` → `SapHetHan`; còn lại `ConHan` (lô `remaining = 0` không trả về khi lọc mặc định).
- **Điều chỉnh** (BR-28): `difference = actualQty − systemQty`, `value = difference × avgCost`.

### 3.9. Báo cáo (BR-30)

Theo ngày (giờ Việt Nam) của `PaidAt` hóa đơn và `CreatedAt` phiếu đổi trả:

- `salesTotal = Σ total` hóa đơn; `refundTotal = Σ refundTotal` phiếu; `netRevenue = salesTotal − refundTotal`.
- `cogs = Σ costAmount` dòng hóa đơn − `Σ costAmount` dòng trả (mọi tình trạng); `grossProfit = netRevenue − cogs`; `marginPct = grossProfit ÷ netRevenue × 100` (0 khi `netRevenue = 0`).
- Theo nhóm, mặt hàng: dòng hóa đơn góp `netAmount`, `costAmount`, `baseQty`; dòng trả trừ `refundAmount`, `costAmount`, `baseQty` vào **mặt hàng của dòng gốc** ở ngày lập phiếu. Nhóm theo `GroupId` chụp trên dòng. Σ các nhóm = tổng tab Doanh thu (TC-45).
- Kỳ trước (`previous`) = khoảng cùng độ dài liền trước `from`.
- Tổng quan: `today` từ 00:00 tới lúc gọi; `sameTimeYesterday` từ 00:00 hôm qua tới cùng giờ phút hôm qua; `avgOrderValue = round1(salesTotal ÷ orderCount)` (0 khi không có hóa đơn); `topProducts` theo Σ `baseQty` bán thuần hôm nay.
- Hàng lỗi (FR-38): dòng trả `HangLoi` trong kỳ; hàng hủy: dòng điều chỉnh có `difference < 0` với lý do `Hong`, `HetHan`, `Mat` (giá trị dương = `|value|`). Không trừ vào lợi nhuận gộp.
- Theo thu ngân: theo ca (`CashierId`); `netRevenue` = Σ tổng hóa đơn của thu ngân − Σ tiền hoàn của phiếu do chính thu ngân đó lập; `totalDifference` = Σ `difference` của ca đã chốt mở trong kỳ.

### 3.10. Mã chứng từ, mã vạch, quét

- Mã chứng từ: SRS §5.3; số thứ tự trong ngày (giờ Việt Nam) tiếp theo số lớn nhất đã có cùng loại cùng ngày.
- Số kiểm tra EAN-13 của 12 số đầu `d1…d12`: `s = Σ d_i × (i lẻ ? 1 : 3)`, `check = (10 − s mod 10) mod 10`. Mã nội bộ kế tiếp: `20` + (số thứ tự lớn nhất trong các mã dạng `20dddddddddd?` + 1, 10 chữ số) + số kiểm tra.
- **Quét** (FR-08, FR-09): chuỗi gõ vào ô quét kết thúc bằng Enter. Khớp `^(\d{1,4})\*(.*)$` → tiền tố số lượng: n = 1–999 thì áp cho lần thêm kế tiếp (quét hoặc chọn gợi ý), sai → báo lỗi, bỏ tiền tố; phần sau `*` khác rỗng thì xử lý ngay như mã. Chuỗi toàn chữ số dài 8–14 → tra mã vạch trên danh mục (khớp đúng). Không phải số → mở gợi ý tìm tên với chuỗi đó. Mã có đầu `21`–`29` (tem cân điện tử) **không** được giải mã trong demo, xử lý như mã thường (§5 quyết định 1).
- Tìm tên (FR-10): `normalizeVi(query)` tách theo khoảng trắng, mọi từ đều nằm trong `searchText`; mỗi kết quả là một **đơn vị** ("{tên} – {đơn vị} {giá}"), hàng đang bán trước, tối đa 20 dòng.

### 3.11. Số tính sẵn cho test

| TC | Đầu vào | Kết quả |
| :--- | :--- | :--- |
| TC-13 | Lon 18.000 + Lốc 6 105.000 + Thùng 24 410.000 | 533.000 |
| TC-14 | 2 lon; `12*` gói mì; thêm 1 gói | 36.000; 54.000; 58.500; tổng 94.500 |
| TC-21 | 3 lon 54.000 + 5 gói 22.500 + 1 hộp sữa 8.000 = 84.500, giảm 5% | 4.225 → 4.000; tổng 80.500; 4,7% không cần xác nhận |
| TC-22 | Thùng bia 410.000, giảm 30.000 | 7,317% → "Giảm 7,3%, vượt hạn mức 5%"; tổng 380.000 |
| TC-23 | Sữa bột 455.000, giảm 4% | 18.200 → 18.000; tổng 437.000 < vốn 440.000 → "Thấp hơn giá vốn 3.000 ₫" |
| TC-25 | 84.500 tiền mặt | Gợi ý 84.500 / 90.000 / 100.000 / 500.000; đưa 100.000 thối 15.500; vốn 46.500 + 18.000 + 6.500 = 71.000; tồn 47 / 85 / 119 |
| Demo bước 4–6 | Lon + Lốc + Thùng + 12 gói = 587.000, giảm 30.000 | 5,1% cần xác nhận; tổng 557.000; gợi ý 557.000 / 560.000 / 600.000 / 1.000.000; đưa 600.000 thối 43.000 |
| HĐ A | Thùng bia 410.000 + Thùng mì 120.000, giảm 5% | Giảm 26.500; phân bổ bia round1(26.500 × 410/530) = 20.500, mì 6.000; thuần 389.500 / 114.000; tổng 503.500; vốn 372.000 / 108.000 |
| TC-30 | Trả hết dòng bia HĐ A | Hoàn 389.500; tồn 50 + 24 = 74 "3 thùng 2 lon"; giá vốn round1((50×15.500 + 24×15.500)/74) = 15.500 |
| TC-31 | Trả 1/2 Lốc 4 sữa HĐ B (thuần 62.000), đổi Lốc 6 bia 105.000 | Hoàn floor500(62.000 × 1/2) = 31.000; chênh 74.000; bù trừ 31.000 + tiền mặt 74.000, đưa 100.000 thối 26.000; tồn sữa 124, bia 44 |
| TC-32 | Trả 2/4 hộp sữa HĐ B (thuần 32.000), hàng lỗi | Hoàn 16.000; hàng lỗi 2 × 6.500 = 13.000; tồn sữa giữ 120 |
| TC-34 | HĐ C 10 ngày | Cần xác nhận; hoàn 105.000 |
| TC-35 | 2 Thùng bia HĐ E | Hoàn 820.000 > 500.000 → cần xác nhận |
| TC-07 | Đầu ca 500.000; HĐ 84.500 tiền mặt; HĐ 410.000 chuyển khoản; hoàn tiền mặt 31.000 | Lý thuyết 500.000 + 84.500 − 31.000 = 553.500; đếm 530.000 → −23.500 Cần kiểm tra; đếm 540.000 → −13.500 Đã chốt |
| TC-27 | Tồn 50, bán 1 thùng, rồi 3 lon | 26 "1 thùng 2 lon" Còn hàng; 23 "3 lốc 5 lon" Sắp hết |
| TC-20 | Tồn bia 50 | "2 thùng 2 lon" |
| TC-37, TC-38 | Sữa tươi 120, lô 96 (+150 ngày) mới, 96 (+20 ngày) cũ | "2 thùng 6 lốc"; giá trị 780.000; lô cũ còn 24; hủy lô về 96: chênh −24, −156.000, "2 thùng", lô cũ hết |
| TC-39 | Mì tồn 90 × 3.600 + 5 Thùng 30 × 114.000 | u = 3.800; round1((324.000 + 570.000) ÷ 240) = 3.725; biên (4.500 − 3.725)/4.500 = 17,2%; tồn 240 "8 thùng" |
| TC-40 | Nước suối 24 × 3.500 + 10 Thùng 24 × 117.600 | u = 4.900; round1(1.260.000 ÷ 264) = 4.773; biên 4,5% (thấp); giá 5.500 → 13,2% |
| Demo bước 11 | Mì còn 78 sau bước 3, nhập 150 × 3.800 | round1((280.800 + 570.000) ÷ 228) = 3.732 |
| TC-42 | Thùng bia, giảm 20.000 | Doanh thu thuần +390.000, giá vốn +372.000, lợi nhuận +18.000 |
| TC-44 | Trả thùng bia HĐ A hôm nay | Hôm nay: hoàn 389.500, giá vốn thuần −372.000, lợi nhuận −17.500 |
| TC-01 | Bia pilsner 17.000, vốn 14.000 | Biên 17,6%; Thùng 24 390.000 ≤ 408.000 không cảnh báo |
| TC-03 | Thùng 24 bia 450.000 | > 18.000 × 24 = 432.000 → cảnh báo, vẫn lưu |

---

## 4. Quy ước riêng cho FE

### 4.1. Trang sau đăng nhập, menu, khung trang

- **Menu** (`config/routes/main.routes.ts`, đã khai báo): Tổng quan `/dashboard` (`reports.view`), Bán hàng `/pos` (`orders.create`), Hóa đơn `/orders`, Đổi trả `/returns`, Ca của tôi `/shifts/current` (ẩn với người có `shifts.view`), Ca làm `/shifts`; nhóm "Kho hàng": Hàng hóa `/products` (`products.create` hoặc `update`), Tồn kho `/stock`, Nhập hàng `/goods-receipts`; nhóm "Kinh doanh": Báo cáo `/reports`, Khách hàng `/customers`; rồi nhóm Cài đặt của nền.
- **Trang sau đăng nhập**: `homeAfterLogin = /dashboard`; `resolveHomePath` của nền rơi xuống mục menu đầu tiên có quyền, nên Thu ngân vào thẳng `/pos` (TC-43). Thu ngân gõ `/shifts`, `/reports`, `/stock`, `/products` → `/forbidden` (TC-12).
- **Khung trang**: `app/(protected)/…` dùng `AppShell` của nền. `app/(pos)/layout.tsx` (mới): `AuthGuard` + `PosShell` toàn màn hình, không sidebar, có `DemoToolbar`; chứa `/pos` và `/returns/new`. `app/(print)/layout.tsx` (mới): `AuthGuard`, không khung, CSS in; chứa `/pos/receipt/[id]`, `/returns/receipt/[id]`, `/shifts/receipt/[id]`, `/products/labels`.
- `/dashboard` thay nội dung `app/(protected)/dashboard/page.tsx` của nền bằng trang của `features/reports`.

### 4.2. Trình diễn không có máy quét (chế độ `mock` trên Vercel)

Người xem `https://pum-pos-ban-le.vercel.app` thường không có máy quét, không có BE. Màn bán hàng phải dùng được hoàn toàn bằng bàn phím và chuột:

1. **Ô quét** luôn có con trỏ (FR-08): gõ mã rồi Enter như máy quét; gõ chữ thì mở gợi ý tên (F2 cũng mở). Máy quét thật gửi ký tự rất nhanh: khi con trỏ đang ở ô khác không phải ô nhập liệu, FE nghe `keydown` toàn trang, chuỗi ≥ 8 chữ số đến cách nhau < 50 ms kết thúc bằng Enter được coi là một lần quét và đưa vào ô quét.
2. **"Mã vạch mẫu"**: nút trên thanh công cụ màn bán hàng mở bảng mã bấm được: 11 mã của hàng trong test case (lon, lốc, thùng bia; gói, thùng mì; hộp, lốc, thùng sữa tươi; chai nước suối; sữa bột; trứng `2000000000015`) và 12 mã ngẫu nhiên từ danh mục (đổi mỗi lần mở). Bấm một mã = quét mã đó (đi đúng đường xử lý của ô quét, kể cả tiền tố `n*` đang gõ). Mỗi mã có nút sao chép.
3. **`DemoToolbar` mục "Máy quét giả lập"** (FE-Bán hàng thêm một `Section` vào `components/demo/DemoToolbar.tsx`): "Quét mã ngẫu nhiên" (một mã đơn vị cơ bản của hàng đang bán còn tồn), "Quét giỏ mẫu" (5 mã liên tiếp, cách 300 ms, kiểm NFR-02), "Quét mã không tồn tại" (`8930000000000`). Gửi bằng `window.dispatchEvent(new CustomEvent('pos:simulate-scan', { detail: { barcode } }))`; màn `/pos` (và hộp F3, màn đổi trả, form phiếu nhập) nghe sự kiện khi đang mở. Ngoài các màn đó nút khóa, chú thích "Mở màn Bán hàng để dùng".
4. **Âm báo**: Web Audio API, bíp ngắn 880 Hz 80 ms khi thêm dòng, hai tiếng trầm 220 Hz khi lỗi; không cần tệp âm thanh. Nút loa trên thanh trên bật/tắt, lưu `localStorage` `retail-pos-ban-le:pos-sound`.
5. **Hàng cân**: không có. Rau, thịt, trái cây trong dữ liệu mẫu là hàng đóng gói sẵn (bó, khay, túi) có mã nội bộ `20…` (§5 quyết định 1).
6. Có máy quét thật: in tem mã vạch từ Hàng hóa → "In tem" rồi quét tem.

### 4.3. Màn bán hàng `/pos` (SCR-02, SCR-03)

- Tối ưu 1366×768 và 1920×1080 (NFR-01). Thanh trên (`PosShell`): logo, tên cửa hàng, thu ngân, mã ca, đồng hồ, các **tab hóa đơn chờ** ("Hóa đơn 1"… kèm số dòng), nút "Mã vạch mẫu", loa, menu (Hóa đơn, Đổi trả, Ca của tôi, Thoát về trang chủ). Bên trái: ô quét lớn + bảng giỏ (STT, tên, đơn vị dạng chọn, số lượng sửa được, đơn giá, giảm, thành tiền, xóa); dòng vượt tồn nền cam `warning` kèm "Vượt tồn {n} {đơn vị}". Bên phải: tổng số lượng, tổng tiền hàng, giảm giá (dòng "Giảm giá hóa đơn" có dấu X gỡ), **tổng thanh toán** cỡ chữ lớn, khách hàng (P3), nút Giảm giá (F8), Thanh toán (F9, `variant="cta"`), Xóa hóa đơn.
- **Phím tắt** (NFR-01, `posHotkeys` trong `config/retail-pos-labels.ts`): F2 tìm hàng, F3 kiểm tra giá, F4 khách hàng, F6 hóa đơn chờ mới, F7 tab kế tiếp, F8 giảm giá, F9 thanh toán, Esc đóng hộp, Enter xác nhận, Delete xóa dòng đang chọn, mũi tên lên/xuống chọn dòng. Chặn hành vi mặc định của F-key trình duyệt (F3 tìm trang, F5 không chặn). Sau mỗi thao tác con trỏ trở về ô quét.
- **Chưa mở ca** (`GET /api/shifts/current` 204): hộp "Mở ca" (tiền đầu ca mặc định `storeProfile.defaultOpeningCash`, sửa được; lệch > 100.000 ₫ hỏi lại). Đóng hộp → ô quét, giỏ khóa, chỉ còn nút "Mở ca" (TC-06).
- **Hóa đơn chờ** (BR-11, FR-12): Zustand persist `localStorage` khóa `retail-pos-ban-le:held:{userId}` = `{ activeId, tabs: [{ id, name, lines: CartLine[], orderDiscount?, approval?, customer?, updatedAt }] }` (tối đa 5). Tải lại trang giữ nguyên (TC-18). `CartLine = { key, productId, unitId, quantity, discount? }` (giá, tên đọc từ danh mục lúc hiển thị).
- **Danh mục** `['pos-catalog']`: `GET /api/pos/catalog`, `staleTime` 5 phút, `refetchInterval` 5 phút, làm mới sau mỗi thanh toán, đổi trả. Bản đồ mã vạch → (sản phẩm, đơn vị) dựng bằng `useMemo`.
- **Thêm dòng** theo §3.3, §3.10; hàng ngừng bán, mã không có → âm báo lỗi, toast đúng câu §2.12, ô quét xóa trắng. Tổng tiền giỏ tính tại máy bằng `pricing.ts` (chưa có giá vốn).
- **Giảm giá** F8 (UC-05): hộp chọn Hóa đơn / Dòng đang chọn, Phần trăm / Số tiền, lý do (`discountReasonLabels`, "Khác" bắt ghi chú). Bấm Áp dụng → `POST /api/orders/quote`; `needsApproval` → hộp "Chủ cửa hàng xác nhận" nêu từng lý do, ô tên đăng nhập, mật khẩu → `POST /api/approvals` (`GiamGia`) → lưu `approval = { token, approvedByName, reasonCodes }` vào tab; lỗi 400/403 hiện dưới ô, giỏ giữ nguyên (TC-24). Không duyệt → không áp.
- **Kiểm tra giá** F3 (UC-04): hộp có ô quét riêng; hiện tên, giá mọi đơn vị, tồn `stockText`; không đổi giỏ (TC-20).
- **Khách hàng** F4 (P3): nhập SĐT → `by-phone`; 404 → form thêm nhanh tên.

### 4.4. Thanh toán, in hóa đơn (SCR-03, SCR-04)

- F9: còn dòng vượt tồn và `allowNegativeStock = false` → không mở, toast "Vượt tồn…" (TC-19). Mở hộp: gọi quote (cần xác nhận mà chưa có token hợp lệ → mở hộp xác nhận trước), sinh `clientRequestId = crypto.randomUUID()` (giữ nguyên khi bấm lại; đổi khi giỏ đổi), gọi `next-code` cho nội dung QR.
- **Tiền mặt** (mặc định): mức gợi ý §3.5 thành nút; ô số tiền; "Tiền thối"; thiếu thì khóa "Hoàn tất", hiện "Còn thiếu …" (TC-26). **Chuyển khoản**: QR từ chuỗi VietQR giả lập (`features/pos/lib/vietqr.ts`, gói `qrcode`), số tiền, nội dung = mã dự kiến; nút "Đã nhận tiền". **Thẻ**: ô mã chuẩn chi (không bắt buộc), nút "Đã quẹt thành công".
- "Hoàn tất" (Enter): khóa nút khi đang gửi; thành công → tiền mặt hiện toast "Đã mở két"; mở bản in qua `iframe` ẩn `/pos/receipt/{id}?print=1` (trình duyệt chặn cửa sổ bật lên); xóa tab hiện tại (còn tab khác thì chuyển sang, hết thì tạo "Hóa đơn 1" trống); làm mới danh mục; con trỏ về ô quét. Lỗi mạng (không có phản hồi) → giữ giỏ, "Chưa lưu được hóa đơn, thử lại", bấm lại cùng `clientRequestId`. 409 `TongTienDaDoi` → quote lại, hiện tổng mới.
- **Bản in** (`app/(print)`): khổ theo `storeProfile.paperSize` (`@page { size: 80mm auto }` hoặc 58 mm, chữ ≥ 11 px ở 58 mm, NFR-05); nội dung FR-20; mã vạch **Code 128** của mã hóa đơn vẽ bằng `jsbarcode` (SVG); `?reprint=1` thêm dòng "IN LẠI {dd/MM/yyyy HH:mm}"; `?print=1` tự gọi `window.print()` khi tải xong. Phiếu đổi trả có dòng "Khách ký nhận" (FR-26). Báo cáo ca in khổ 80 mm.

### 4.5. Đổi trả, ca làm

- **Đổi trả** `/returns` (danh sách, SCR-05) có nút "Tạo phiếu đổi trả" → `/returns/new` (toàn màn hình, `PosShell`). Chưa mở ca → nút khóa kèm "Mở ca trước khi đổi trả" (TC-06). Ô quét nhận mã `HD…` (quét mã Code 128 trên bill) → `GET /api/returns/source`; "Tìm hóa đơn" mở hộp lọc ngày mua, mặt hàng. Bảng dòng gốc: đã mua, đã trả, còn trả được, đơn giá thực thu; dòng `returnable = false` mờ "Hàng không đổi trả" (TC-33). Mỗi dòng: số lượng trả (ô đỏ "Tối đa {n}" khi vượt, khóa Hoàn tất, TC-36), tình trạng, lý do. Phần "Hàng đổi" dùng lại ô quét, giỏ của màn bán hàng. Tổng: tiền hoàn, hàng đổi, chênh lệch; hình thức hoàn (tiền mặt mặc định). Cần xác nhận → hộp xác nhận (`DoiTra`) trước khi gửi. Chênh lệch dương → hộp thanh toán §4.4 với số tiền chênh lệch. Thành công → in phiếu đổi trả (và hóa đơn đổi nếu có).
- **Ca của tôi** `/shifts/current` (SCR-06): chưa có ca → form mở ca; có ca → tổng hợp `ShiftDto` (làm mới khi vào trang), nút "Chốt ca". Chốt ca: kiểm hóa đơn chờ trong `localStorage` của người dùng, tab nào có dòng thì liệt kê và chặn (TC-10) kèm nút "Về màn bán hàng"; bảng mệnh giá (số tờ), tiền thực đếm, chênh lệch xanh `success` khi ≤ 20.000 ₫, đỏ `danger` khi vượt (bắt ghi chú, TC-08); xác nhận → in báo cáo ca, xóa mọi tab chờ trống, về trạng thái chưa mở ca.
- **Ca làm** `/shifts` (SCR-07, FE-Quản lý): mặc định 7 ngày, lọc thu ngân, trạng thái, khoảng ngày; ca `CanKiemTra` nhãn đỏ; chi tiết (ngăn kéo hoặc trang) từ `ShiftDetail`: tổng hợp như lúc chốt, hóa đơn, phiếu đổi trả, các khoản có người xác nhận; form ghi chú + "Đã kiểm tra" (chỉ `shifts.review`, chỉ ca `CanKiemTra`; ca đang mở không có nút, UC-10 E1); "In báo cáo ca" mở `/shifts/receipt/{id}?reprint=1`.

### 4.6. Màn quản lý

- **Hàng hóa** `/products` (SCR-09): tab Mặt hàng, Nhóm hàng. Bảng: ảnh (ô màu + ảnh kiểu bao bì), mã, tên, nhóm, đơn vị cơ bản, giá bán, giá vốn, biên lãi (nền cam khi `isLowMargin`), tồn (`stockText`), trạng thái; cột giá vốn, biên lãi ẩn khi thiếu `products.view-cost`. Form: tên, nhóm, đơn vị cơ bản, mã vạch (nút "Sinh mã nội bộ"), giá bán, giá vốn ban đầu (chỉ khi thêm), tồn tối thiểu, công tắc "Quản lý hạn sử dụng", "Cho đổi trả", trạng thái, kiểu ảnh (`productImageKinds`), màu; mục "Đơn vị quy đổi" tối đa 3 dòng (tên, hệ số, mã vạch, giá, hiện "Giá tham khảo"); cảnh báo BR-04 tại ô. Lỗi 409 gắn đúng ô bằng `applyFieldErrors`. "In tem" (P3): chọn nhiều dòng → `/products/labels?ids=…&copies=…` tem 40 × 30 mm (tên, đơn vị, giá, mã vạch EAN-13, hoặc Code 128 khi mã không đủ 13 số). Tab Nhóm hàng: kéo thả thứ tự, sửa tên, màu, công tắc ẩn.
- **Tồn kho** `/stock` (SCR-10): tab Tồn kho (dòng tổng giá trị đầu bảng từ `summary`, lọc nhóm, trạng thái; bấm dòng mở ngăn kéo lịch sử biến động, mã chứng từ là link), tab Sắp hết hạn (`lots`, nút "Hủy lô" mở form điều chỉnh điền sẵn mặt hàng, lý do Hết hạn, số lượng thực tế = tồn − còn lại của lô), tab Phiếu điều chỉnh. Tổng quan bấm thẻ cảnh báo → `/stock?status=SapHet` hoặc `/stock?tab=lots` (UC-11 4a).
- **Nhập hàng** `/goods-receipts` (SCR-11): tab Phiếu nhập, Nhà cung cấp. `/goods-receipts/new` và `/goods-receipts/{id}` (SCR-12): chọn hoặc thêm nhanh NCC, ô quét mã (lookup) hoặc tìm tên, dòng: đơn vị (chọn), số lượng, đơn giá nhập (gợi ý giá vốn × hệ số), HSD (ô ngày, chỉ khi `trackExpiry`), thành tiền; tổng phiếu; "Lưu nháp", "Xác nhận nhập kho". Phiếu đã nhập kho chỉ xem, hiện giá vốn trước/sau từng dòng, không có Sửa, Xóa (TC-41). Sau xác nhận: hộp "Biên lãi dưới 5%" từ `lowMarginProducts`, mỗi dòng ô sửa giá các đơn vị → `PATCH prices`, hoặc "Bỏ qua".
- **Tổng quan** `/dashboard` (SCR-01): 4 thẻ số `KpiCard` kèm % so cùng giờ hôm qua; biểu đồ cột doanh thu thuần + đường lợi nhuận 7 ngày (Recharts); top 10 hôm nay; 2 thẻ cảnh báo (sắp hết = `lowStockCount`, lô = `expiringLotCount` + `expiredLotCount`) bấm được. Dùng được trên điện thoại.
- **Báo cáo** `/reports` (SCR-13): tab Doanh thu (mặc định 30 ngày, đường kỳ trước làm nền), Lợi nhuận theo nhóm, Theo mặt hàng (chọn xếp hạng), Đổi trả và hàng lỗi, Thu ngân, Phương thức. Chọn nhanh Hôm nay, 7 ngày, 30 ngày, Tháng này, Tháng trước, Tùy chọn (chặn > 366 ngày trước khi gọi). "Xuất Excel" (P3).
- Định dạng: tiền `formatVnd`, phần trăm 1 chữ số dấu phẩy, số âm dùng "−". Trạng thái dùng `StatusBadge` với biến thể trong `retail-pos-labels.ts`.

### 4.7. Query key (dùng đúng để làm mới chéo)

`['pos-catalog']`, `['store-profile']`, `['product-groups']`, `['products', query]`, `['product', id]`, `['orders', query]`, `['order', id]`, `['returns', query]`, `['return', id]`, `['shift-current']`, `['shifts', query]`, `['shift', id]`, `['stock', query]`, `['stock-summary', query]`, `['stock-lots', query]`, `['stock-movements', productId, query]`, `['stock-adjustments', query]`, `['suppliers', query]`, `['goods-receipts', query]`, `['goods-receipt', id]`, `['reports', loại, query]`, `['customers', query]`. Sau thanh toán, đổi trả: làm mới `pos-catalog`, `shift-current`, `orders`, `returns`, `stock*`, `products`, `reports`. Sau nhập kho, điều chỉnh, sửa hàng hóa: `pos-catalog`, `products`, `stock*`. Mock-db đổi ở tab khác đã có `invalidateQueries` của nền.

### 4.8. Mock

- **Collection** (`mockDb.collection`, scope `business`, khai báo **chỉ** trong `features/pos/mock/pos.db.ts`): `product-groups`, `products` (đơn vị lồng trong bản ghi), `suppliers`, `goods-receipts` (dòng lồng; chỉ phiếu nháp mẫu + phiếu tạo trong phiên), `stock-adjustments` (chỉ phiếu tạo trong phiên), `shifts` (mọi ca, 180 bản ghi), `orders` (dòng, khoản thu lồng; chỉ hóa đơn hôm nay đã nạp + tạo trong phiên), `returns` (mọi phiếu, 80 bản ghi + phiếu mới), `customers`. Kiểu bản ghi `*Record` trong `FE/src/types/retail-pos.ts`. Cài đặt đọc `settingsDb` của nền (`@/mock/system-data`), id tài khoản bằng `userIdOf(username)`.
- **Lịch sử chỉ đọc trong bộ nhớ**: hóa đơn trước hôm nay (~5.000), phiếu nhập đã nhập kho mẫu (38), phiếu điều chỉnh mẫu (12) dựng lại từ seed mỗi lần tải trang (module `history.ts`), **không** ghi localStorage (giới hạn ~5 MB). Không thao tác nào sửa chúng: trạng thái trả hàng của hóa đơn, `returnedQty`, `refundedAmount` suy ra từ collection `returns` lúc đọc. Hàm `allOrders()`, `allReceipts()`, `allAdjustments()` trả hợp hai nguồn. Đặt lại dữ liệu xóa mock-db và dựng lại kho bộ nhớ (`mockDb.onReset`).
- **Nạp seed**: `mockDb.registerSeed('demo-data', demoData)`; suy ra trường đúng `06` §5.2–5.3 (lọc hóa đơn, ca hôm nay theo giờ lúc nạp), `stableId` như `06` §5.2, tiền tính bằng `pricing.ts`.
- **Sổ biến động, lô** không lưu: dựng theo `06` §5.4 từ mọi chứng từ (lịch sử + mock-db), có cache theo `productId`, xóa cache khi mock-db đổi.
- Mã chứng từ sinh trong handler theo §3.10 xét cả hai nguồn. Lỗi đúng ProblemDetails có `code` (§2.12). Độ trễ giả 200–400 ms, riêng `POST /api/orders` ≤ 300 ms (NFR-03).

### 4.9. Chia việc FE (hai agent làm song song)

Đã viết sẵn, **dùng chung, không agent nào tự đổi cấu trúc** (cần đổi hợp đồng thì sửa 07 trước rồi báo bên kia): `src/types/retail-pos.ts`, `src/config/retail-pos-labels.ts`, `src/config/pos-rules.ts`, `src/config/permissions.ts`, `src/config/route-path.ts`, `src/config/routes/*.ts`, `src/config/api-routes.ts`, `src/config/setting-labels.ts`, `src/mock/seed/*.json`, `scripts/generate-history.mjs`. Được **thêm** hằng mới vào các file config (nối cuối nhóm của mình), không sửa dòng của bên kia. `package.json` đã có `jsbarcode`, `qrcode`, `@types/qrcode`, `write-excel-file`; gói mới chỉ FE-Bán hàng thêm (FE-Quản lý nhắn FE-Bán hàng). `scripts/generate-product-images.mjs` và `public/seed/products/` thuộc agent vẽ ảnh, không sửa.

| | **FE-Bán hàng** | **FE-Quản lý** |
| :--- | :--- | :--- |
| Màn hình | `/pos` (SCR-02, 03), bản in hóa đơn, phiếu đổi trả, báo cáo ca (SCR-04), `/orders` (SCR-08), `/returns`, `/returns/new` (SCR-05), `/shifts/current` (SCR-06), `/customers` (SCR-14, P3), mục "Máy quét giả lập" của `DemoToolbar` | `/dashboard` (SCR-01), `/products` + in tem (SCR-09), `/stock` (SCR-10), `/goods-receipts`, `/goods-receipts/new`, `/goods-receipts/[id]` (SCR-11, 12), `/shifts` (SCR-07), `/reports` (SCR-13) |
| Thư mục feature sở hữu | `features/pos/` (lõi, xem dưới, + màn bán hàng), `features/orders/`, `features/returns/`, `features/shifts/` (service + mock **mọi** API `/api/shifts`), `features/customers/` | `features/products/` (nhóm hàng, hàng hóa, tem), `features/stock/` (tồn, lô, sổ biến động, điều chỉnh), `features/goods-receipts/` (NCC, phiếu nhập), `features/shift-review/` (chỉ giao diện `/shifts`, gọi `shiftService` của FE-Bán hàng), `features/reports/` (tổng quan, báo cáo) |
| Route `app/` | `app/(pos)/layout.tsx`, `app/(pos)/pos/**`, `app/(pos)/returns/new/**`, `app/(print)/layout.tsx`, `app/(print)/pos/receipt/**`, `app/(print)/returns/receipt/**`, `app/(print)/shifts/receipt/**`, `app/(protected)/orders/**`, `app/(protected)/returns/page.tsx`, `app/(protected)/shifts/current/**`, `app/(protected)/customers/**` | `app/(protected)/dashboard/page.tsx` (thay nội dung), `app/(protected)/products/**`, `app/(print)/products/labels/**`, `app/(protected)/stock/**`, `app/(protected)/goods-receipts/**`, `app/(protected)/shifts/page.tsx`, `app/(protected)/reports/**` |
| Collection mock-db | **Khai báo, nạp seed tất cả** trong `features/pos/mock/pos.db.ts` | Không khai báo; handler đọc, ghi qua `posDb.*` và hàm của lõi |
| Handler mock | `pos/mock` (catalog, store-profile, approvals), `orders/mock` (quote, checkout, list, detail, next-code), `returns/mock`, `shifts/mock`, `customers/mock` | `products/mock` (nhóm, hàng hóa, lookup, mã nội bộ, giá), `stock/mock` (tồn, summary, lô, sổ biến động, điều chỉnh), `goods-receipts/mock` (NCC, phiếu nhập, xác nhận BR-23), `reports/mock` (mọi `/api/reports/*`) |
| File nền được sửa | `components/demo/DemoToolbar.tsx` (thêm một `Section`), `app/theme.css` (thêm token nếu thiếu), `package.json` | Không sửa file nền ngoài trang dashboard |

**Lõi `features/pos/` (FE-Bán hàng viết, FE-Quản lý chỉ import). Mốc 1, làm trước tiên** để FE-Quản lý dùng ngay:

| File | Xuất ra |
| :--- | :--- |
| `lib/vn-time.ts` | `vnNow()`, `vnDateKey(iso)` → `yyyy-MM-dd`, `vnDateTime(dayOffset, 'HH:mm')` → ISO UTC, `vnMinutesOfDay(iso)`, `daysBetweenVn(fromIso, toIso)`, `vnDayRange(from, to)` (chép demo 03/04) |
| `lib/pricing.ts` | `discountAmount(base, d)`, `priceCart(lines, unitLookup)` → `{ lines: QuoteLine[], subtotal, lineDiscountTotal, orderDiscountAmount, discountTotal, discountPct, total }` (§3.1–3.2), `approvalReasons(quote, expectedCost)` (§3.4), `cashSuggestions(total)`, `pointsFor(total)`, `refundForLine(line, q)` (§3.6) |
| `lib/stock-math.ts` | `stockText(stock, units)` (BR-02), `stockStatus(stock, min)`, `marginPct(price, cost)`, `nextAvgCost(stock, cost, qIn, unitCostIn)` (§3.8), `estimateLots(stock, lots)` (BR-27) |
| `lib/barcode.ts` | `ean13CheckDigit(d12)`, `isValidEan13(code)`, `nextInternalBarcode(existing)`, `parseScanInput(text)` → `{ prefixQty?, code?, search?, error? }` (§3.10) |
| `lib/vietqr.ts` | `vietQrPayload(store, amount, content)` |
| `lib/doc-code.ts` | `nextDocCode(prefix, digits, dayKey, existingCodes)` |
| `components/ProductImage.tsx` | Ô ảnh hàng hóa (nền `color`, ảnh `imageUrl` qua `useAssetUrl`, chữ viết tắt khi thiếu ảnh); size `sm` / `md` / `lg` |
| `components/BarcodeSvg.tsx` | Vẽ mã vạch SVG bằng `jsbarcode` (`format` `CODE128` / `EAN13`) |
| `components/QrImage.tsx` | Vẽ QR từ chuỗi (gói `qrcode`) |
| `components/ManagerApprovalDialog.tsx` | Hộp "Chủ cửa hàng xác nhận" nhận `action`, `reasons`, trả `ApprovalDto` |
| `mock/history.ts` | Kho chỉ đọc trong bộ nhớ: `historyOrders()`, `historyReceipts()`, `historyAdjustments()` (kiểu `*Record`) |
| `mock/pos.db.ts` | `posDb.groups / products / suppliers / receipts / adjustments / shifts / orders / returns / customers` (collection), `allOrders()`, `allReceipts()`, `allAdjustments()`, `allReturns()`, `productById(id)`, `unitByBarcode(code)`, `groupById(id)`, `supplierById(id)`, `shiftById(id)`, `userIdOf(username)`, `settingValue(key)` |
| `mock/mappers.ts` | `toProductDto(r, canViewCost)`, `toCatalog()`, `toOrderDto(r, canViewCost)`, `toOrderListItem(r)`, `toReturnDto(r, canViewCost)`, `toReturnListItem(r)`, `toShiftDto(r)` (tổng hợp ca §3.7 từ `allOrders`, `allReturns`), `returnedQtyOf(orderLineId)` |

Mốc 2 (FE-Bán hàng): handler, service của `orders`, `returns`, `shifts` (gồm `shiftService.list/detail/review` FE-Quản lý gọi). Trước mốc 2, FE-Quản lý viết trang `/shifts` với `shiftService` trả mảng rỗng. Sổ biến động, lô, tổng hợp báo cáo (`features/stock/mock/ledger.ts`, `features/reports/mock/facts.ts`) do **FE-Quản lý** viết trên `allOrders()`, `allReturns()`, `allReceipts()`, `allAdjustments()` và `stock-math.ts`.

Service: mỗi feature có `services/*.service.ts` riêng, chỉ gọi đường dẫn trong `apiRoutes`. Không import file mock vào component.

### 4.10. Thứ tự làm BE (một agent)

Namespace theo `BE-CAU-TRUC-THU-MUC.md`; Area `Inventory`, `Pos`, `Crm`; module `ProductGroups`, `Products`, `Suppliers`, `GoodsReceipts`, `StockAdjustments`, `Stock`, `Shifts`, `Orders`, `Returns`, `Approvals`, `Reports`, `Customers`, `StoreProfile`. Chép từ demo 02/03: `Application/Common/Time/VietnamTime.cs`, `VietnamDates.cs`, phần xác nhận quản lý (`DiscountApprovalService` → `ApprovalService`, đổi theo §2.5), `SeedJson` ngày tương đối.

1. **Domain**: enum `06` §4 ở `Domain/Enums/{Inventory,Pos,Crm}/…`; entity `Inventory/ProductGroups/ProductGroup.cs`, `Inventory/Products/{Product,ProductUnit}.cs`, `Inventory/Suppliers/Supplier.cs`, `Inventory/GoodsReceipts/{GoodsReceipt,GoodsReceiptLine}.cs`, `Inventory/StockAdjustments/{StockAdjustment,StockAdjustmentLine}.cs`, `Inventory/Stock/StockMovement.cs`, `Pos/Shifts/Shift.cs`, `Pos/Orders/{Order,OrderLine,OrderPayment}.cs`, `Pos/Returns/{Return,ReturnLine}.cs`, `Crm/Customers/Customer.cs`; `Domain/Entities/Pos/PosRules.cs` (hằng số `06` §3), `PosErrors.cs` (mã §2.12), `OrderPricing.cs` (§3.1–3.6), `StockMath.cs` (§3.8), `Barcodes.cs` (§3.10).
2. **Persistence**: `Infrastructure/Persistence/Configurations/{Inventory,Pos,Crm}/*.cs` (unique, index, concurrency `Version`, `date` cho ngày thuần); migration `Add_RetailPos` (Postgres).
3. **Seed**: `RetailSeedRecords.cs` (kiểu đọc JSON khóa gọn `06` §5.2), `DemoDataSeeder.cs` nạp đúng `06` §5.2–5.4 (gồm lọc hôm nay theo giờ, sổ biến động); kiểm số `06` §5.5 bằng `GET /api/reports/revenue?from=…&to=…` (89 ngày) và `GET /api/stock/summary`. `project.json` đã có quyền, vai trò, tài khoản, cài đặt.
4. **Hàng hóa**: DTO, validator, mapping, `IProductGroupService`, `IProductService` (tìm `NameSearch`, kiểm mã vạch toàn cục, `EverUsed`, mã nội bộ), `IPosCatalogService` (ETag); controller `ProductGroups`, `Products`, `PosCatalog`. `Permissions.cs` thêm nhóm như §1.
5. **Ca, xác nhận, bán hàng**: `IShiftService`, `IApprovalService` (IMemoryCache, 400/403 §2.5), `IOrderService` (quote, checkout idempotent, transaction + retry `Version`, mã HD), `IStoreProfileService`; controller `Shifts`, `Approvals`, `Orders`, `StoreProfile`.
6. **Đổi trả**: `IReturnService` (source, source-orders, create kèm hóa đơn đổi, BR-18/19/20); controller `Returns`.
7. **Kho**: `IStockService` (danh sách, summary, lô BR-27, sổ biến động), `IStockAdjustmentService`, `ISupplierService`, `IGoodsReceiptService` (confirm BR-23, `lowMarginProducts`); controller tương ứng.
8. **Báo cáo, khách**: `IReportService` + repository riêng `IRetailReportRepository` (truy vấn gộp theo ngày giờ Việt Nam), `ICustomerService`; controller `Reports`, `Customers`. Kiểm `PUT /api/settings` theo `setting-labels.ts`.
9. Kiểm: `dotnet publish` không lỗi (máy dev không có Docker/Postgres; dùng Postgres portable nếu cần chạy), chạy tay qua Swagger các TC trọng tâm: TC-02, 04, 07, 08, 13, 22, 23, 25, 29, 30, 31, 34, 37, 39, 40, 44, 45.

---

## 5. Quyết định thiết kế (BE và FE làm theo)

Những điểm SRS, use case chưa nói rõ đã chốt như sau; FE mock làm giống BE để hai chế độ ra cùng kết quả.

| # | Chỗ | Quyết định | Lý do |
| :---: | :--- | :--- | :--- |
| 1 | Hàng cân (rau, thịt) | **Không** giải mã tem cân điện tử. Hàng tươi bán theo gói định lượng sẵn (bó 500g, khay 300g, túi 1kg) có mã nội bộ `20…`, số lượng nguyên. Mã đầu `21`–`29` xử lý như mã thường (thường là "Không tìm thấy mã vạch"). Quy tắc dự phòng cho bản triển khai (chưa code): EAN-13 `2` + `2` + 5 số mã PLU + 5 số (khối lượng gam hoặc số tiền ₫/10) + số kiểm tra; cần đổi số lượng sang `numeric(18,3)` | SRS §1.2, §2.4 để ngoài phạm vi, BR-01 tồn số nguyên; kịch bản demo §3 đã trả lời khách "Demo chưa có" |
| 2 | Tổng quan và vai trò | `/dashboard`, `GET /api/reports/dashboard` gắn `reports.view`; không dùng `dashboard.view` | `system.json` cấp `dashboard.view` cho `MANAGER`, `STAFF`; TC-43 Thu ngân không thấy doanh thu |
| 3 | Tài khoản | `admin`, `quanly` (Chủ cửa hàng, Trần Thị Mai), `thungan` (Lê Thị Thu Hằng, có Đăng nhập nhanh), `thungan2` (Nguyễn Văn Phúc, không có thẻ), `nhanvien` tắt (`enabled: false`) | Quy định chủ kho: tài khoản theo nghiệp vụ, 2 thu ngân để báo cáo theo thu ngân |
| 4 | "Ca của mình" | Không có `shifts.view` → chỉ chứng từ thuộc ca do mình mở (mọi ngày) | SRS §7 không có quyền "xem tất cả" riêng; `shifts.view` là "Xem mọi ca" |
| 5 | Giá vốn với thu ngân | Danh mục máy bán hàng không có giá vốn; điều kiện "dưới giá vốn" tính ở `POST /api/orders/quote` | Thu ngân không được thấy giá vốn (kịch bản demo §3); câu "Thấp hơn giá vốn 3.000 ₫" do SRS yêu cầu |
| 6 | Hạn mức 5% | So `discountTotal ÷ subtotal` chưa làm tròn, "> 5%" mới cần xác nhận (đúng 5% tự giảm được) | BR-08 "tối đa 5%"; HĐ A giảm đúng 5% không có người duyệt |
| 7 | Dưới giá vốn | Kiểm mọi hóa đơn kể cả không giảm giá | BR-09 "kể cả khi mức giảm nằm trong hạn mức" |
| 8 | Xác nhận | Token một lần, 15 phút, gắn `action`; giỏ đổi mà tập lý do đổi thì gỡ giảm giá | UC-05 E3; thu ngân còn quét thêm sau khi duyệt |
| 9 | Hóa đơn chờ | Chỉ ở `localStorage` theo tài khoản; BE không biết; kiểm BR-11 khi chốt ca ở FE | SRS §5.1 "không lưu vào cơ sở dữ liệu" |
| 10 | Một phương thức mỗi hóa đơn | Thu ngân chọn một trong tiền mặt, chuyển khoản, thẻ; chỉ hóa đơn đổi hàng có thêm dòng bù trừ | FR-17, FR-18 không nói trả nhiều phương thức |
| 11 | Tiền thối, tiền mặt lý thuyết | Khoản tiền mặt ghi `Amount` = số phải thu (đã trừ thối); `expectedCash = đầu ca + Σ tiền mặt thu − Σ tiền mặt hoàn` | BR-21; TC-07 = 553.500 |
| 12 | Bù trừ đổi hàng | Không phải tiền mặt, không vào `expectedCash`; hiện riêng ở tổng hợp ca và báo cáo phương thức | BR-20 |
| 13 | Hàng đổi | Không giảm giá, giá hiện hành, không đổi khách | Đơn giản quầy; SRS không yêu cầu |
| 14 | Mỗi lần trả hết dòng | Tiền hoàn = phần thuần còn lại (có thể lẻ, không bội số 500) | BR-18 câu 2 |
| 15 | Ngày đổi trả | Ngày lịch giờ Việt Nam, ngày mua là 0 | BR-17 |
| 16 | Trả hàng và giá vốn | Hàng bán lại được nhập lại theo giá vốn dòng gốc, tính lại bình quân | BR-19 |
| 17 | Đổi đơn vị dòng | Giữ số lượng, xóa giảm dòng nếu có (giảm số tiền có thể vượt thành tiền mới) | BR-06 |
| 18 | Mã vạch | Không bắt buộc ở mọi đơn vị (hàng chưa có mã tìm theo tên hoặc sinh mã nội bộ); unique khi có, kể cả hàng ngừng bán, đã xóa mềm | BR-03; UC-01 3a |
| 19 | Đọc tồn quy đổi | Từ đầu tiên của tên đơn vị, chữ thường; tồn 0 → "0 {đơn vị}" | BR-02 không nói tồn 0 |
| 20 | Lô | Không có bảng lô; lô = dòng phiếu nhập hàng có HSD, còn lại tính lúc đọc | BR-27 là ước tính |
| 21 | Hủy lô | Phiếu điều chỉnh lý do Hết hạn, điền sẵn thực tế = tồn − còn lại lô, lưu `GoodsReceiptLineId` | UC-13 bước 1 |
| 22 | Sổ hàng lỗi | Là dòng trả `HangLoi`, không có bảng riêng | Đủ trường; tránh hai nguồn số |
| 23 | Phiếu nhập | Lưu nháp không bắt HSD; xác nhận mới bắt | TC-41 bước 1 bấm Xác nhận mới báo lỗi |
| 24 | Đồng thời tồn | Concurrency token `Version` trên hàng hóa, làm lại tối đa 3 lần | Hai quầy bán cùng mặt hàng |
| 25 | Danh mục máy bán hàng | Gồm cả hàng ngừng bán (để báo "Hàng ngừng bán"), ETag | UC-03 E2, NFR-02 |
| 26 | Lịch sử ở mock | Chỉ đọc, giữ trong bộ nhớ; hôm nay và thứ tạo trong phiên ở localStorage | Giới hạn ~5 MB localStorage |
| 27 | Dữ liệu hôm nay | Nạp theo giờ lúc nạp; `thungan2` đứng cả hai ca hôm nay, `thungan` chưa có ca | Lúc nào mở demo cũng có số liệu "hôm nay" thật; TC-05 |
| 28 | Lịch sử mẫu không đổi giá vốn | Phiếu nhập mẫu theo đúng giá vốn | Giá vốn test case (15.500, 3.600…) giữ nguyên; thay đổi giá vốn thấy qua TC-39, TC-40 |
| 29 | Giả lập quét | Bảng "Mã vạch mẫu" + mục `DemoToolbar` phát `pos:simulate-scan` | Người xem không có máy quét (§4.2) |
| 30 | In | `iframe` ẩn, `window.print()`; Code 128 bằng `jsbarcode` | Trình duyệt chặn cửa sổ bật lên; NFR-05 |
| 31 | Nhật ký thao tác | Không ghi hóa đơn, đổi trả, ca, biến động tồn | Ghi rất nhiều; chứng từ đã chụp người, giờ |
| 32 | Mệnh giá đếm tiền | Thêm 500 ₫ (UC-09 sửa "tới 500 ₫") | TC-07 đếm 553.500 ₫ cần tờ 500 |
| 33 | Tìm kiếm không dấu | Cột `NameSearch` bỏ dấu ghi sẵn, `LIKE` thường | Chạy được cả SQLite, SQL Server; NFR-04 |
| 34 | Nhóm của dòng hóa đơn ở mock | Bản ghi dòng hóa đơn mock lưu `groupId` lúc bán như cột `GroupId` của BE; báo cáo theo nhóm (cả dòng trả) lấy nhóm chụp trên dòng gốc, bản ghi thiếu thì lấy nhóm hiện tại | Đổi nhóm hàng sau khi bán không làm lệch báo cáo giữa mock và BE (§3.9) |
| 35 | `ReturnDto.difference` khi không đổi hàng | `−refundTotal` (BE và mock như nhau) | Một công thức cho danh sách và chi tiết phiếu |
| 36 | Bán khi tồn đã âm | Vượt tồn = Σ số lượng cơ bản trong giỏ − max(tồn, 0): tồn âm sẵn thì mọi số lượng bán đều vượt; tắt "Cho phép bán âm kho" thì chặn (BE `VuotTon` 400) và FE khóa nút Thanh toán | BR-10, TC-19 |
| 37 | Gửi lại cùng `clientRequestId` | BE trả 200 kèm chứng từ đã tạo (lần đầu 201); FE xử lý 200 và 201 như nhau | NFR-06, TC-29 |
| 38 | Mã ca kế tiếp, người kiểm tra ca | Số thứ tự lớn nhất cùng ngày + 1 (§3.10); `ReviewedByName` là họ tên, `ApprovedByName` là tên đăng nhập người xác nhận | Ca chỉ có một thu ngân mở; TC-11, TC-22 |
| 39 | Lỗi theo trường form không hiển thị | Form gắn lỗi vào ô có trên form; khóa khác (vd `lines[0].unitId`, `goodsReceiptLineId`, `imageUrl`, `status`) hiện toast | Không để lỗi BE bị nuốt |
| 40 | Sắp xếp nhà cung cấp | `sortBy` `receiptCount`, `totalPurchased`, `lastReceiptAt` sắp trong bộ nhớ sau khi tính số liệu nhập | Các cột này không phải cột bảng |
