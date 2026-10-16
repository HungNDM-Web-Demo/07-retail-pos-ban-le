import { z } from 'zod'

/** Phiếu điều chỉnh tồn (UC-13, BR-28). Câu lỗi đúng 07 §2.8. */
export const adjustmentLineSchema = z.object({
  productId: z.string(),
  code: z.string(),
  name: z.string(),
  baseUnit: z.string(),
  systemQty: z.number(),
  avgCost: z.number().nullable(),
  actualQty: z
    .number({ error: 'Nhập số lượng thực tế' })
    .refine((v) => Number.isInteger(v) && v >= 0, 'Số lượng thực tế không âm'),
})

export const stockAdjustmentSchema = z
  .object({
    reason: z.enum(['Hong', 'HetHan', 'Mat', 'DemLai', 'Khac'], { error: 'Chọn lý do' }),
    note: z.string().max(500, 'Tối đa 500 ký tự'),
    goodsReceiptLineId: z.string().optional(),
    lines: z.array(adjustmentLineSchema).min(1, 'Thêm ít nhất một mặt hàng'),
  })
  .superRefine((v, ctx) => {
    if (v.reason === 'Khac' && !v.note.trim()) ctx.addIssue({ code: 'custom', path: ['note'], message: 'Nhập ghi chú' })
    if (v.lines.length > 0 && v.lines.every((l) => l.actualQty === l.systemQty)) {
      ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Không có chênh lệch để điều chỉnh' })
    }
  })

export type StockAdjustmentFormValues = z.infer<typeof stockAdjustmentSchema>
export type AdjustmentLineValues = z.infer<typeof adjustmentLineSchema>
