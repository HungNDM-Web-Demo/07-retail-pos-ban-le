import { normalizeVi } from '@/lib/normalize'
import { mockHash } from '@/mock/mock-helpers'
import type {
  OrderDto,
  OrderListItem,
  OrderRecord,
  OrderReturnStatus,
  PaymentMethod,
  PosCatalog,
  ProductDto,
  ProductRecord,
  ReturnDto,
  ReturnListItem,
  ReturnRecord,
  ShiftDto,
  ShiftRecord,
} from '@/types/retail-pos'
import { isLowMargin, marginPct, stockStatus, stockText } from '../lib/stock-math'
import {
  allAdjustments,
  allOrders,
  allReceipts,
  allReturns,
  customerById,
  groupById,
  memoOnChange,
  orderById,
  posDb,
  shiftById,
} from './pos.db'

/**
 * Bản ghi mock-db → DTO đúng 07 §2 (dùng chung FE-Bán hàng và FE-Quản lý). `canViewCost = false` thì mọi
 * trường giá vốn là null (07 §1). Trạng thái trả hàng, số đã trả suy ra từ collection `returns` lúc đọc.
 */

// ───────────────────────── Chỉ mục dùng chung ─────────────────────────

/** Dòng hóa đơn → số đã trả (theo đơn vị của dòng), tiền đã hoàn */
const returnedIndex = memoOnChange(['returns'], () => {
  const map = new Map<string, { returnedQty: number; refundedAmount: number }>()
  for (const r of allReturns()) {
    for (const l of r.lines) {
      const cur = map.get(l.orderLineId) ?? { returnedQty: 0, refundedAmount: 0 }
      map.set(l.orderLineId, {
        returnedQty: cur.returnedQty + l.quantity,
        refundedAmount: cur.refundedAmount + l.refundAmount,
      })
    }
  }
  return map
})

/** Số đã trả và tiền đã hoàn của một dòng hóa đơn */
export const lineReturnState = (orderLineId: string) =>
  returnedIndex().get(orderLineId) ?? { returnedQty: 0, refundedAmount: 0 }

/** Số lượng đã trả của dòng hóa đơn (theo đơn vị của dòng) */
export const returnedQtyOf = (orderLineId: string): number => lineReturnState(orderLineId).returnedQty

/** Phiếu đổi trả theo hóa đơn gốc */
const returnsByOrder = memoOnChange(['returns'], () => {
  const map = new Map<string, ReturnRecord[]>()
  for (const r of allReturns()) map.set(r.orderId, [...(map.get(r.orderId) ?? []), r])
  return map
})
export const returnsOfOrder = (orderId: string): ReturnRecord[] => returnsByOrder().get(orderId) ?? []

/** Trạng thái trả hàng của hóa đơn: chưa trả / một phần / hết (mọi dòng đã trả đủ, khớp BE) */
export function returnStatusOf(order: OrderRecord): OrderReturnStatus {
  let any = false
  let all = true
  for (const l of order.lines) {
    const q = returnedQtyOf(l.id)
    if (q > 0) any = true
    if (q < l.quantity) all = false
  }
  if (!any) return 'ChuaTra'
  return all ? 'TraHet' : 'TraMotPhan'
}

/** Đơn vị, mặt hàng đã có trong chứng từ (BR-29: không xóa, không đổi hệ số) */
const documentIndex = memoOnChange(['orders', 'receipts', 'adjustments'], () => {
  const units = new Set<string>()
  const products = new Set<string>()
  for (const o of allOrders())
    for (const l of o.lines) {
      units.add(l.unitId)
      products.add(l.productId)
    }
  for (const r of allReceipts())
    for (const l of r.lines) {
      units.add(l.unitId)
      products.add(l.productId)
    }
  for (const a of allAdjustments()) for (const l of a.lines) products.add(l.productId)
  return { units, products }
})
export const isUnitUsed = (unitId: string) => documentIndex().units.has(unitId)
export const productHasDocuments = (productId: string) => documentIndex().products.has(productId)

// ───────────────────────── Hàng hóa, danh mục ─────────────────────────

export function toProductDto(r: ProductRecord, canViewCost: boolean): ProductDto {
  const group = groupById(r.groupId)
  const base = r.units.find((u) => u.sortOrder === 0) ?? r.units[0]
  const units = [...r.units].sort((a, b) => a.sortOrder - b.sortOrder)
  const margin = marginPct(base.price, r.avgCost)
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    groupId: r.groupId,
    groupName: group?.name ?? '',
    groupColor: group?.color ?? r.color,
    baseUnit: base.name,
    barcode: base.barcode ?? undefined,
    price: base.price,
    units: units.map((u) => ({
      id: u.id,
      name: u.name,
      factor: u.factor,
      barcode: u.barcode ?? undefined,
      price: u.price,
      isBase: u.sortOrder === 0,
      sortOrder: u.sortOrder,
      everUsed: isUnitUsed(u.id),
    })),
    avgCost: canViewCost ? r.avgCost : undefined,
    marginPct: canViewCost && margin !== null ? margin : undefined,
    isLowMargin: canViewCost ? isLowMargin(margin) : undefined,
    stock: r.stock,
    stockText: stockText(r.stock, units),
    stockStatus: stockStatus(r.stock, r.minStock),
    minStock: r.minStock,
    trackExpiry: r.trackExpiry,
    returnable: r.returnable,
    status: r.status,
    imageUrl: r.imageUrl ?? undefined,
    color: r.color,
    hasDocuments: productHasDocuments(r.id),
    createdAt: r.createdAt,
  }
}

/** Danh mục máy bán hàng (07 §2.3): gồm cả hàng ngừng bán, không có giá vốn; `version` đổi khi hàng, giá, tồn đổi */
export function toCatalog(): PosCatalog {
  const products = posDb.products.all()
  const groups = posDb.groups.all().sort((a, b) => a.sortOrder - b.sortOrder)
  const items = products
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((p) => {
      const units = [...p.units].sort((a, b) => a.sortOrder - b.sortOrder)
      return {
        productId: p.id,
        code: p.code,
        name: p.name,
        searchText: normalizeVi(`${p.name} ${p.code}`),
        groupId: p.groupId,
        baseUnit: units[0]?.name ?? '',
        units: units.map((u) => ({
          unitId: u.id,
          name: u.name,
          factor: u.factor,
          barcode: u.barcode ?? undefined,
          price: u.price,
        })),
        stock: p.stock,
        minStock: p.minStock,
        status: p.status,
        returnable: p.returnable,
        imageUrl: p.imageUrl ?? undefined,
        color: p.color,
      }
    })
  const fingerprint = items
    .map((i) => `${i.productId}|${i.stock}|${i.status}|${i.name}|${i.units.map((u) => `${u.unitId}:${u.price}:${u.barcode ?? ''}`).join(',')}`)
    .join(';')
  return {
    version: mockHash(fingerprint + groups.map((g) => `${g.id}${g.name}${g.isHidden}`).join('')).slice(0, 16),
    generatedAt: new Date().toISOString(),
    groups: groups.map((g) => ({ id: g.id, name: g.name, color: g.color, sortOrder: g.sortOrder, isHidden: g.isHidden })),
    items,
  }
}

// ───────────────────────── Hóa đơn ─────────────────────────

const lineDiscountTotalOf = (r: OrderRecord) => r.lines.reduce((s, l) => s + (l.discount?.amount ?? 0), 0)

export function toOrderDto(r: OrderRecord, canViewCost: boolean): OrderDto {
  const shift = shiftById(r.shiftId)
  const customer = r.customerId ? customerById(r.customerId) : undefined
  const exchangeFor = r.exchangeForReturnId ? allReturns().find((x) => x.id === r.exchangeForReturnId) : undefined
  const lineDiscountTotal = lineDiscountTotalOf(r)
  const lines = r.lines.map((l, i) => {
    const state = lineReturnState(l.id)
    const baseQty = l.quantity * l.factor
    return {
      id: l.id,
      lineNo: i + 1,
      productId: l.productId,
      productCode: l.productCode,
      productName: l.productName,
      unitId: l.unitId,
      unitName: l.unitName,
      factor: l.factor,
      quantity: l.quantity,
      baseQty,
      unitPrice: l.unitPrice,
      amount: l.unitPrice * l.quantity,
      discount: l.discount ?? undefined,
      allocatedDiscount: l.allocatedDiscount,
      netAmount: l.netAmount,
      unitCost: canViewCost ? l.unitCost : undefined,
      costAmount: canViewCost ? baseQty * l.unitCost : undefined,
      returnable: l.returnable,
      returnedQty: state.returnedQty,
      refundedAmount: state.refundedAmount,
    }
  })
  const orderDiscountAmount = r.orderDiscount?.amount ?? 0
  return {
    id: r.id,
    code: r.code,
    paidAt: r.paidAt,
    shiftId: r.shiftId,
    shiftCode: shift?.code ?? '',
    cashierId: r.cashierId,
    cashierName: r.cashierName,
    lines,
    subtotal: r.subtotal,
    lineDiscountTotal,
    orderDiscount: r.orderDiscount ?? undefined,
    discountTotal: lineDiscountTotal + orderDiscountAmount,
    total: r.total,
    costTotal: canViewCost ? r.lines.reduce((s, l) => s + l.quantity * l.factor * l.unitCost, 0) : undefined,
    payments: r.payments,
    approvedByName: r.approvedByName ?? undefined,
    customer: customer ? { id: customer.id, phone: customer.phone, name: customer.name } : undefined,
    pointsEarned: r.pointsEarned,
    returnStatus: returnStatusOf(r),
    note: r.note ?? undefined,
    exchangeForReturn: exchangeFor ? { id: exchangeFor.id, code: exchangeFor.code } : undefined,
    returns: returnsOfOrder(r.id).map((x) => ({
      id: x.id,
      code: x.code,
      createdAt: x.createdAt,
      refundTotal: x.refundTotal,
    })),
    qrContent: r.qrContent ?? undefined,
    createdAt: r.paidAt,
  }
}

export function toOrderListItem(r: OrderRecord): OrderListItem {
  const customer = r.customerId ? customerById(r.customerId) : undefined
  const methods: PaymentMethod[] = []
  for (const p of r.payments) if (!methods.includes(p.method)) methods.push(p.method)
  return {
    id: r.id,
    code: r.code,
    paidAt: r.paidAt,
    shiftCode: shiftById(r.shiftId)?.code ?? '',
    cashierName: r.cashierName,
    itemCount: r.lines.reduce((s, l) => s + l.quantity, 0),
    subtotal: r.subtotal,
    discountTotal: lineDiscountTotalOf(r) + (r.orderDiscount?.amount ?? 0),
    total: r.total,
    paymentMethods: methods,
    returnStatus: returnStatusOf(r),
    isExchange: !!r.exchangeForReturnId,
    customerName: customer?.name,
    approvedByName: r.approvedByName ?? undefined,
    note: r.note ?? undefined,
  }
}

// ───────────────────────── Đổi trả ─────────────────────────

export function toReturnDto(r: ReturnRecord, canViewCost: boolean): ReturnDto {
  const order = orderById(r.orderId)
  const exchange = r.exchangeOrderId ? orderById(r.exchangeOrderId) : undefined
  const exchangeTotal = exchange?.total ?? 0
  return {
    id: r.id,
    code: r.code,
    createdAt: r.createdAt,
    shiftId: r.shiftId,
    shiftCode: shiftById(r.shiftId)?.code ?? '',
    cashierId: r.cashierId,
    cashierName: r.cashierName,
    orderId: r.orderId,
    orderCode: order?.code ?? '',
    orderPaidAt: order?.paidAt ?? '',
    lines: r.lines.map((l) => {
      const src = order?.lines.find((x) => x.id === l.orderLineId)
      const factor = src?.factor ?? 1
      const baseQty = l.quantity * factor
      const unitCost = src?.unitCost ?? 0
      return {
        id: l.id,
        orderLineId: l.orderLineId,
        productId: l.productId,
        productCode: src?.productCode ?? '',
        productName: src?.productName ?? '',
        unitName: src?.unitName ?? '',
        factor,
        quantity: l.quantity,
        baseQty,
        condition: l.condition,
        reason: l.reason,
        note: l.note ?? undefined,
        refundAmount: l.refundAmount,
        unitCost: canViewCost ? unitCost : undefined,
        costAmount: canViewCost ? baseQty * unitCost : undefined,
      }
    }),
    refundTotal: r.refundTotal,
    offsetAmount: r.offsetAmount,
    payoutAmount: r.refundTotal - r.offsetAmount,
    refundMethod: r.refundMethod,
    exchangeOrder: exchange ? { id: exchange.id, code: exchange.code, total: exchange.total } : undefined,
    difference: exchangeTotal - r.refundTotal,
    approvedByName: r.approvedByName ?? undefined,
    note: r.note ?? undefined,
    pointsDeducted: r.pointsDeducted,
  }
}

export function toReturnListItem(r: ReturnRecord): ReturnListItem {
  const order = orderById(r.orderId)
  const exchange = r.exchangeOrderId ? orderById(r.exchangeOrderId) : undefined
  return {
    id: r.id,
    code: r.code,
    createdAt: r.createdAt,
    cashierName: r.cashierName,
    orderCode: order?.code ?? '',
    refundTotal: r.refundTotal,
    payoutAmount: r.refundTotal - r.offsetAmount,
    refundMethod: r.refundMethod,
    exchangeOrderCode: exchange?.code,
    difference: (exchange?.total ?? 0) - r.refundTotal,
    hasDefective: r.lines.some((l) => l.condition === 'HangLoi'),
    approvedByName: r.approvedByName ?? undefined,
  }
}

// ───────────────────────── Ca ─────────────────────────

const ordersByShift = memoOnChange(['orders'], () => {
  const map = new Map<string, OrderRecord[]>()
  for (const o of allOrders()) {
    const list = map.get(o.shiftId)
    if (list) list.push(o)
    else map.set(o.shiftId, [o])
  }
  return map
})
const returnsByShift = memoOnChange(['returns'], () => {
  const map = new Map<string, ReturnRecord[]>()
  for (const r of allReturns()) map.set(r.shiftId, [...(map.get(r.shiftId) ?? []), r])
  return map
})

/** Hóa đơn, phiếu đổi trả thuộc ca */
export const ordersOfShift = (shiftId: string): OrderRecord[] => ordersByShift().get(shiftId) ?? []
export const returnsOfShift = (shiftId: string): ReturnRecord[] => returnsByShift().get(shiftId) ?? []

/** Tổng hợp ca (07 §3.7, BR-21, BR-22): ca đang mở tính tới lúc gọi */
export function toShiftDto(r: ShiftRecord): ShiftDto {
  const orders = ordersOfShift(r.id)
  const returns = returnsOfShift(r.id)
  const salesByMethod: Record<PaymentMethod, number> = { TienMat: 0, ChuyenKhoan: 0, The: 0, BuTruDoiHang: 0 }
  for (const o of orders) for (const p of o.payments) salesByMethod[p.method] += p.amount
  const refundByMethod = { TienMat: 0, ChuyenKhoan: 0, BuTruDoiHang: 0 }
  for (const x of returns) {
    refundByMethod[x.refundMethod] += x.refundTotal - x.offsetAmount
    refundByMethod.BuTruDoiHang += x.offsetAmount
  }
  const salesTotal = orders.reduce((s, o) => s + o.total, 0)
  const refundTotal = returns.reduce((s, x) => s + x.refundTotal, 0)
  const expectedCash = r.openingCash + salesByMethod.TienMat - refundByMethod.TienMat
  const counted = r.countedCash ?? undefined
  return {
    id: r.id,
    code: r.code,
    status: r.status,
    cashierId: r.cashierId,
    cashierName: r.cashierName,
    openedAt: r.openedAt,
    closedAt: r.closedAt ?? undefined,
    openingCash: r.openingCash,
    orderCount: orders.length,
    returnCount: returns.length,
    salesByMethod,
    salesTotal,
    refundByMethod,
    refundTotal,
    netRevenue: salesTotal - refundTotal,
    expectedCash,
    countedCash: counted,
    difference: counted !== undefined ? counted - expectedCash : undefined,
    cashCount: r.cashCount ?? undefined,
    note: r.note ?? undefined,
    reviewNote: r.reviewNote ?? undefined,
    reviewedByName: r.reviewedByName ?? undefined,
    reviewedAt: r.reviewedAt ?? undefined,
  }
}
