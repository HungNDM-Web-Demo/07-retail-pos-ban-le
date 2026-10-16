import { nextAvgCost, estimateLots, lotStatus } from '@/features/pos/lib/stock-math'
import { diffDaysKey, vnDateTime, vnTodayKey } from '@/features/pos/lib/vn-time'
import {
  allAdjustments,
  allOrders,
  allReceipts,
  allReturns,
  memoOnChange,
  orderById,
  posDb,
  productById,
} from '@/features/pos/mock/pos.db'
import type { MovementType, StockLotDto, StockMovementDto } from '@/types/retail-pos'

/**
 * Sổ biến động tồn và lô (06 §5.4, 07 §3.8) dựng trong bộ nhớ từ mọi chứng từ (lịch sử + mock-db), không lưu.
 * Bộ nhớ đệm tự xóa khi collection liên quan đổi (`memoOnChange` của lõi).
 *
 * - Mỗi hàng hóa mẫu một dòng `TonDau` lúc 00:00 ngày −89 (hàng tạo trong phiên tồn đầu 0 thì không có dòng này).
 * - Cùng thời điểm: phiếu nhập → hóa đơn → phiếu đổi trả → điều chỉnh; cùng loại theo thứ tự chứng từ, trong chứng từ theo dòng.
 * - Giá vốn sau: dòng nhập lấy `costAfter` đã ghi lúc xác nhận (BR-23); trả hàng bán lại được tính lại bình quân với
 *   giá vốn dòng gốc (BR-19); bán, điều chỉnh không đổi giá vốn.
 */

type Event = {
  at: string
  t: number
  kind: number // 0 nhập, 1 bán, 2 trả, 3 điều chỉnh
  docIndex: number
  lineIndex: number
  type: MovementType
  documentId: string
  documentCode: string
  quantity: number
  costAfter?: number | null // dòng nhập đã ghi
  costBefore?: number | null
  returnUnitCost?: number // dòng trả bán lại được
}

const HISTORY_DAYS = -89

const ledger = memoOnChange(['orders', 'returns', 'receipts', 'adjustments', 'products'], () => {
  const events = new Map<string, Event[]>()
  const push = (productId: string, e: Event) => {
    const list = events.get(productId)
    if (list) list.push(e)
    else events.set(productId, [e])
  }

  allReceipts().forEach((r, docIndex) => {
    if (r.status !== 'DaNhapKho' || !r.confirmedAt) return
    const t = new Date(r.confirmedAt).getTime()
    r.lines.forEach((l, lineIndex) =>
      push(l.productId, {
        at: r.confirmedAt!,
        t,
        kind: 0,
        docIndex,
        lineIndex,
        type: 'NhapHang',
        documentId: r.id,
        documentCode: r.code,
        quantity: l.quantity * l.factor,
        costAfter: l.costAfter,
        costBefore: l.costBefore,
      })
    )
  })
  allOrders().forEach((o, docIndex) => {
    const t = new Date(o.paidAt).getTime()
    o.lines.forEach((l, lineIndex) =>
      push(l.productId, {
        at: o.paidAt,
        t,
        kind: 1,
        docIndex,
        lineIndex,
        type: 'BanHang',
        documentId: o.id,
        documentCode: o.code,
        quantity: -l.quantity * l.factor,
      })
    )
  })
  allReturns().forEach((r, docIndex) => {
    const order = orderById(r.orderId)
    const t = new Date(r.createdAt).getTime()
    r.lines.forEach((l, lineIndex) => {
      if (l.condition !== 'BanLaiDuoc') return
      const src = order?.lines.find((x) => x.id === l.orderLineId)
      if (!src) return
      push(src.productId, {
        at: r.createdAt,
        t,
        kind: 2,
        docIndex,
        lineIndex,
        type: 'TraHang',
        documentId: r.id,
        documentCode: r.code,
        quantity: l.quantity * src.factor,
        returnUnitCost: src.unitCost,
      })
    })
  })
  allAdjustments().forEach((a, docIndex) => {
    const t = new Date(a.createdAt).getTime()
    a.lines.forEach((l, lineIndex) => {
      const diff = l.actualQty - l.systemQty
      if (diff === 0) return
      push(l.productId, {
        at: a.createdAt,
        t,
        kind: 3,
        docIndex,
        lineIndex,
        type: 'DieuChinh',
        documentId: a.id,
        documentCode: a.code,
        quantity: diff,
      })
    })
  })

  const openingAt = vnDateTime(HISTORY_DAYS, '00:00')
  const openingT = new Date(openingAt).getTime()
  const result = new Map<string, StockMovementDto[]>()
  for (const p of posDb.products.all()) {
    const list = (events.get(p.id) ?? []).sort(
      (a, b) => a.t - b.t || a.kind - b.kind || a.docIndex - b.docIndex || a.lineIndex - b.lineIndex
    )
    const firstReceipt = list.find((e) => e.kind === 0 && e.costBefore !== null && e.costBefore !== undefined)
    let cost = firstReceipt?.costBefore ?? p.avgCost
    let stock = 0
    const rows: StockMovementDto[] = []
    const seedProduct = new Date(p.createdAt).getTime() <= openingT
    if (seedProduct || p.openingStock !== 0) {
      stock = p.openingStock
      rows.push({
        id: `${p.id}:opening`,
        at: seedProduct ? openingAt : p.createdAt,
        type: 'TonDau',
        documentCode: 'Tồn đầu kỳ',
        quantity: p.openingStock,
        stockAfter: stock,
        costAfter: cost,
      })
    }
    for (const e of list) {
      if (e.kind === 0) cost = e.costAfter ?? nextAvgCost(stock, cost, e.quantity, cost)
      else if (e.kind === 2) cost = nextAvgCost(stock, cost, e.quantity, e.returnUnitCost ?? cost)
      stock += e.quantity
      rows.push({
        id: `${e.documentId}:${e.lineIndex}`,
        at: e.at,
        type: e.type,
        documentId: e.documentId,
        documentCode: e.documentCode,
        quantity: e.quantity,
        stockAfter: stock,
        costAfter: cost,
      })
    }
    result.set(p.id, rows)
  }
  return result
})

/** Sổ biến động của một mặt hàng, cũ → mới */
export const movementsOf = (productId: string): StockMovementDto[] => ledger().get(productId) ?? []

/** Mọi lô (dòng nhập có HSD của phiếu đã nhập kho), số còn lại ước tính theo tồn hiện tại (BR-27) */
export const allLots = memoOnChange(['receipts', 'products'], (): StockLotDto[] => {
  const today = vnTodayKey()
  type Raw = Omit<StockLotDto, 'remainingQty' | 'status' | 'daysLeft'> & { sortKey: string }
  const byProduct = new Map<string, Raw[]>()
  for (const r of allReceipts()) {
    if (r.status !== 'DaNhapKho') continue
    r.lines.forEach((l, j) => {
      if (!l.expiryDate) return
      const p = productById(l.productId)
      if (!p || !p.trackExpiry) return
      const base = p.units.find((u) => u.sortOrder === 0) ?? p.units[0]
      const raw: Raw = {
        goodsReceiptLineId: l.id,
        goodsReceiptId: r.id,
        goodsReceiptCode: r.code,
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        baseUnit: base?.name ?? '',
        receivedAt: r.confirmedAt ?? r.receivedDate,
        expiryDate: l.expiryDate,
        receivedQty: l.quantity * l.factor,
        sortKey: `${r.receivedDate}|${r.confirmedAt ?? ''}|${String(j).padStart(4, '0')}`,
      }
      const list = byProduct.get(p.id)
      if (list) list.push(raw)
      else byProduct.set(p.id, [raw])
    })
  }
  const lots: StockLotDto[] = []
  for (const [productId, list] of byProduct) {
    const p = productById(productId)
    if (!p) continue
    // Mới → cũ: ngày nhập, giờ xác nhận, thứ tự dòng
    list.sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0))
    for (const lot of estimateLots(p.stock, list)) {
      const { sortKey: _sortKey, ...rest } = lot
      void _sortKey
      const daysLeft = diffDaysKey(today, lot.expiryDate)
      lots.push({ ...rest, daysLeft, status: lotStatus(lot.remainingQty, daysLeft) })
    }
  }
  return lots.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.productCode.localeCompare(b.productCode))
})
