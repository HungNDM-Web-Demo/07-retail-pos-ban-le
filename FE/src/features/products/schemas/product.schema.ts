import { z } from 'zod'
import { posRules } from '@/config/pos-rules'

/**
 * Form mặt hàng (UC-01, FR-04, FR-05). Câu lỗi đúng chữ 07 §2.2 để FE và BE báo giống nhau.
 * Mã vạch trùng (409) chỉ BE/mock kiểm, gắn vào ô bằng applyFieldErrors.
 */

const PRICE_MESSAGE = 'Giá phải là bội số của 500 ₫'
const BARCODE_MESSAGE = 'Mã vạch gồm 8 đến 14 chữ số'

const price = z
  .number({ error: PRICE_MESSAGE })
  .refine((v) => Number.isFinite(v) && v > 0 && v % posRules.priceStep === 0, PRICE_MESSAGE)

const barcode = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d{8,14}$/.test(v), BARCODE_MESSAGE)

export const productUnitSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Nhập tên đơn vị'),
  factor: z
    .number({ error: 'Hệ số là số nguyên từ 2 đến 1.000' })
    .refine(
      (v) => Number.isInteger(v) && v >= posRules.minFactor && v <= posRules.maxFactor,
      'Hệ số là số nguyên từ 2 đến 1.000'
    ),
  barcode,
  price,
  /** Đơn vị đã có trong chứng từ: không xóa, không đổi hệ số (BR-29); chỉ để hiển thị */
  everUsed: z.boolean().optional(),
})

export const productSchema = z
  .object({
    name: z.string().trim().min(1, 'Nhập tên mặt hàng').max(200, 'Tối đa 200 ký tự'),
    groupId: z.string().min(1, 'Chọn nhóm hàng'),
    baseUnit: z.string().trim().min(1, 'Nhập đơn vị cơ bản').max(50, 'Tối đa 50 ký tự'),
    barcode,
    price,
    initialCost: z
      .number({ error: 'Giá vốn không âm' })
      .refine((v) => Number.isFinite(v) && v >= 0, 'Giá vốn không âm'),
    minStock: z
      .number({ error: 'Tồn tối thiểu là số nguyên không âm' })
      .refine((v) => Number.isInteger(v) && v >= 0, 'Tồn tối thiểu là số nguyên không âm'),
    trackExpiry: z.boolean(),
    returnable: z.boolean(),
    status: z.enum(['DangBan', 'NgungBan']),
    imageKind: z.string(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Màu dạng #RRGGBB'),
    units: z.array(productUnitSchema).max(posRules.maxConversionUnits, 'Tối đa 3 đơn vị quy đổi'),
  })
  .superRefine((values, ctx) => {
    // Tên đơn vị trùng trong mặt hàng (kể cả đơn vị cơ bản)
    const seen = new Map<string, number>()
    seen.set(values.baseUnit.trim().toLowerCase(), -1)
    values.units.forEach((u, i) => {
      const key = u.name.trim().toLowerCase()
      if (key && seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['units', i, 'name'], message: 'Tên đơn vị bị trùng' })
      }
      seen.set(key, i)
    })
    // Mã vạch trùng ngay trong form
    const codes = new Map<string, string>()
    if (values.barcode) codes.set(values.barcode, 'barcode')
    values.units.forEach((u, i) => {
      if (!u.barcode) return
      if (codes.has(u.barcode)) {
        ctx.addIssue({ code: 'custom', path: ['units', i, 'barcode'], message: 'Mã vạch bị trùng trong mặt hàng' })
      }
      codes.set(u.barcode, `units.${i}.barcode`)
    })
  })

export type ProductFormValues = z.infer<typeof productSchema>
export type ProductUnitFormValues = z.infer<typeof productUnitSchema>

export const productGroupSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên nhóm hàng').max(100, 'Tối đa 100 ký tự'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Màu dạng #RRGGBB'),
})
export type ProductGroupFormValues = z.infer<typeof productGroupSchema>

/** Sửa nhanh giá các đơn vị (hộp "Biên lãi dưới 5%" sau nhập kho, UC-14 bước 6) */
export const pricesSchema = z.object({
  prices: z.array(z.object({ unitId: z.string(), price })),
})
export type PricesFormValues = z.infer<typeof pricesSchema>
