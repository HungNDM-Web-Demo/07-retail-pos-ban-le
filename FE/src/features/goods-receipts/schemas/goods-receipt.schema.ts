import { z } from 'zod'

/** Phiếu nhập (UC-14, FR-34, BR-24). Lưu nháp không bắt hạn sử dụng; xác nhận mới bắt (quyết định 23). */
export const receiptLineSchema = z.object({
  productId: z.string(),
  unitId: z.string().min(1, 'Chọn đơn vị'),
  quantity: z
    .number({ error: 'Số lượng lớn hơn 0' })
    .refine((v) => Number.isInteger(v) && v > 0, 'Số lượng lớn hơn 0')
    .refine((v) => v <= 9999, 'Số lượng tối đa 9.999'),
  unitPrice: z.number({ error: 'Đơn giá không âm' }).refine((v) => Number.isFinite(v) && v >= 0, 'Đơn giá không âm'),
  expiryDate: z.string(),
})

export const goodsReceiptSchema = z.object({
  supplierId: z.string().min(1, 'Chọn nhà cung cấp'),
  receivedDate: z.string().min(1, 'Chọn ngày nhập'),
  note: z.string().max(500, 'Tối đa 500 ký tự'),
  lines: z.array(receiptLineSchema).min(1, 'Thêm ít nhất một mặt hàng'),
})

export type GoodsReceiptFormValues = z.infer<typeof goodsReceiptSchema>
export type ReceiptLineValues = z.infer<typeof receiptLineSchema>

export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên nhà cung cấp').max(200, 'Tối đa 200 ký tự'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^0\d{9}$/.test(v), 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0'),
  address: z.string().max(300, 'Tối đa 300 ký tự'),
  note: z.string().max(500, 'Tối đa 500 ký tự'),
})
export type SupplierFormValues = z.infer<typeof supplierSchema>
