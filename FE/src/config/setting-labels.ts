/**
 * Nhãn, gợi ý và quy tắc kiểm tra cho khóa cài đặt riêng của dự án (project.json → settings;
 * docs/06-THIET-KE-CSDL.md §3, docs/07-DANH-SACH-API.md §2.11). Trang Cài đặt chung hiển thị khóa ngoài
 * nhóm Thương hiệu/Doanh nghiệp theo nhóm ("Cửa hàng", "Bán hàng"); mock gọi `validateProjectSettings`
 * khi lưu, BE kiểm cùng quy tắc trong `PUT /api/settings`.
 */
export const settingExtraLabels: Record<string, { label: string; hint?: string }> = {
  'Store.Name': { label: 'Tên cửa hàng', hint: 'In ở đầu hóa đơn, phiếu đổi trả, báo cáo ca' },
  'Store.Address': { label: 'Địa chỉ', hint: 'In trên hóa đơn' },
  'Store.Phone': { label: 'Số điện thoại cửa hàng', hint: 'In trên hóa đơn' },
  'Store.TaxCode': { label: 'Mã số thuế', hint: 'In trên hóa đơn, có thể bỏ trống' },
  'Store.ReceiptFooter': { label: 'Lời chào cuối hóa đơn' },
  'Store.BankBin': { label: 'Mã ngân hàng (BIN)', hint: '6 chữ số theo VietQR, vd 970418' },
  'Store.BankAccount': {
    label: 'Số tài khoản nhận chuyển khoản',
    hint: 'Dùng cho QR chuyển khoản giả lập',
  },
  'Store.BankAccountName': { label: 'Tên chủ tài khoản', hint: 'Chữ in hoa không dấu' },
  'Pos.ReceiptPaperSize': { label: 'Khổ giấy in hóa đơn', hint: '80 hoặc 58 (mm)' },
  'Pos.AllowNegativeStock': {
    label: 'Cho phép bán âm kho',
    hint: 'true: bán vượt tồn vẫn thanh toán được (tô cam dòng); false: khóa nút Thanh toán (BR-10)',
  },
  'Pos.DefaultOpeningCash': {
    label: 'Tiền đầu ca mặc định (₫)',
    hint: 'Số nguyên không âm, vd 500000',
  },
  'Pos.ReturnPolicy': { label: 'Chính sách đổi trả in cuối hóa đơn' },
}

/** Kiểm tra giá trị cài đặt riêng của dự án; trả về { [chỉ số trong items]: thông báo lỗi }. */
export function validateProjectSettings(
  items: { key: string; value?: string | null }[],
  current: Record<string, string>
): Record<number, string> {
  void current
  const errors: Record<number, string> = {}
  items.forEach(({ key, value }, i) => {
    const v = (value ?? '').trim()
    switch (key) {
      case 'Store.Name':
        if (!v) errors[i] = 'Nhập tên cửa hàng'
        break
      case 'Store.BankBin':
        if (!/^\d{6}$/.test(v)) errors[i] = 'Mã ngân hàng gồm 6 chữ số'
        break
      case 'Store.BankAccount':
        if (!/^\d{6,19}$/.test(v)) errors[i] = 'Số tài khoản gồm 6 đến 19 chữ số'
        break
      case 'Pos.ReceiptPaperSize':
        if (v !== '80' && v !== '58') errors[i] = 'Khổ giấy là 80 hoặc 58'
        break
      case 'Pos.AllowNegativeStock':
        if (v !== 'true' && v !== 'false') errors[i] = 'Giá trị là true hoặc false'
        break
      case 'Pos.DefaultOpeningCash':
        if (!/^\d{1,12}$/.test(v)) errors[i] = 'Tiền đầu ca là số nguyên không âm'
        break
    }
  })
  return errors
}
