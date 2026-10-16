import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { cleanPhone } from '@/lib/validators'
import { requirePermission } from '@/mock/mock-auth'
import { conflict, notFound } from '@/mock/mock-errors'
import { listQuery, newId, paginate, sortItems } from '@/mock/mock-helpers'
import { toOrderListItem } from '@/features/pos/mock/mappers'
import { allOrders, customerById, memoOnChange, posDb } from '@/features/pos/mock/pos.db'
import { fieldError } from '@/features/pos/mock/pos.errors'
import type { PaginatedResult } from '@/types/api'
import type {
  CreateCustomerRequest,
  CustomerDto,
  CustomerQuery,
  CustomerRecord,
  OrderListItem,
} from '@/types/retail-pos'

/** API `/api/customers` (07 §2.11, P3). Số đơn, tổng chi tiêu, lần mua cuối tính từ hóa đơn lúc đọc. */

const PHONE = /^0\d{9}$/

const statsIndex = memoOnChange(['orders'], () => {
  const map = new Map<string, { orderCount: number; totalSpent: number; lastOrderAt?: string }>()
  for (const o of allOrders()) {
    if (!o.customerId) continue
    const cur = map.get(o.customerId) ?? { orderCount: 0, totalSpent: 0 }
    map.set(o.customerId, {
      orderCount: cur.orderCount + 1,
      totalSpent: cur.totalSpent + o.total,
      lastOrderAt: !cur.lastOrderAt || o.paidAt > cur.lastOrderAt ? o.paidAt : cur.lastOrderAt,
    })
  }
  return map
})

function toDto(c: CustomerRecord): CustomerDto {
  const s = statsIndex().get(c.id)
  return {
    id: c.id,
    phone: c.phone,
    name: c.name,
    points: c.points,
    orderCount: s?.orderCount ?? 0,
    totalSpent: s?.totalSpent ?? 0,
    lastOrderAt: s?.lastOrderAt,
    createdAt: c.createdAt,
  }
}

export const customerMock = {
  async list(query: CustomerQuery): Promise<PaginatedResult<CustomerDto>> {
    await mockDelay()
    requirePermission(permissions.customers.view)
    const rows = posDb.customers.all().map(toDto)
    return listQuery(rows, query, { searchFields: ['name', 'phone'], defaultSortBy: 'lastOrderAt' })
  },

  async byPhone(phone: string): Promise<CustomerDto> {
    await mockDelay(120, 220)
    requirePermission(permissions.customers.view)
    const value = cleanPhone(phone) ?? ''
    const found = posDb.customers.find((c) => c.phone === value)
    if (!found) throw notFound(`Chưa có khách với số ${value}`)
    return toDto(found)
  },

  async detail(id: string): Promise<CustomerDto> {
    await mockDelay()
    requirePermission(permissions.customers.view)
    const found = customerById(id)
    if (!found) throw notFound('Không tìm thấy khách hàng')
    return toDto(found)
  },

  async orders(id: string, query: { page?: number; pageSize?: number }): Promise<PaginatedResult<OrderListItem>> {
    await mockDelay()
    requirePermission(permissions.customers.view)
    const rows = sortItems(
      allOrders().filter((o) => o.customerId === id),
      'paidAt',
      'desc'
    )
    const page = paginate(rows, query)
    return { ...page, items: page.items.map(toOrderListItem) }
  },

  async create(input: CreateCustomerRequest): Promise<CustomerDto> {
    await mockDelay()
    requirePermission(permissions.customers.create)
    const phone = cleanPhone(input.phone) ?? ''
    const name = input.name?.trim()
    if (!PHONE.test(phone)) throw fieldError({ phone: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0' })
    if (!name) throw fieldError({ name: 'Nhập tên khách' })
    if (posDb.customers.some((c) => c.phone === phone)) {
      throw conflict('Số điện thoại đã có khách', { phone: 'Số điện thoại đã có khách' })
    }
    const record: CustomerRecord = { id: newId(), phone, name, points: 0, createdAt: new Date().toISOString() }
    posDb.customers.insert(record)
    return toDto(record)
  },
}
