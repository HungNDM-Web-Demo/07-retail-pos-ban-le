import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type { CreateCustomerRequest, CustomerDto, CustomerQuery, OrderListItem } from '@/types/retail-pos'
import { customerMock } from '../mock/customer.mock'

/** API `/api/customers` (07 §2.11, P3) */
export const customerService = {
  list: (query: CustomerQuery): Promise<PaginatedResult<CustomerDto>> =>
    isMockMode()
      ? customerMock.list(query)
      : apiCall.get<PaginatedResult<CustomerDto>>(apiRoutes.customers.list, { params: query }),

  byPhone: (phone: string): Promise<CustomerDto> =>
    isMockMode() ? customerMock.byPhone(phone) : apiCall.get<CustomerDto>(apiRoutes.customers.byPhone(phone)),

  detail: (id: string): Promise<CustomerDto> =>
    isMockMode() ? customerMock.detail(id) : apiCall.get<CustomerDto>(apiRoutes.customers.detail(id)),

  orders: (id: string, query: { page?: number; pageSize?: number }): Promise<PaginatedResult<OrderListItem>> =>
    isMockMode()
      ? customerMock.orders(id, query)
      : apiCall.get<PaginatedResult<OrderListItem>>(apiRoutes.customers.orders(id), { params: query }),

  create: (input: CreateCustomerRequest): Promise<CustomerDto> =>
    isMockMode() ? customerMock.create(input) : apiCall.post<CustomerDto>(apiRoutes.customers.list, input),
}
