import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  CartInput,
  CheckoutRequest,
  NextCodeDto,
  OrderDto,
  OrderListItem,
  OrderQuery,
  OrderQuote,
} from '@/types/retail-pos'
import { orderMock } from '../mock/order.mock'

/** API `/api/orders` (07 §2.4) */
export const orderService = {
  quote: (input: CartInput): Promise<OrderQuote> =>
    isMockMode() ? orderMock.quote(input) : apiCall.post<OrderQuote>(apiRoutes.orders.quote, input),

  checkout: (input: CheckoutRequest): Promise<OrderDto> =>
    isMockMode() ? orderMock.checkout(input) : apiCall.post<OrderDto>(apiRoutes.orders.list, input),

  list: (query: OrderQuery): Promise<PaginatedResult<OrderListItem>> =>
    isMockMode()
      ? orderMock.list(query)
      : apiCall.get<PaginatedResult<OrderListItem>>(apiRoutes.orders.list, { params: query }),

  detail: (id: string): Promise<OrderDto> =>
    isMockMode() ? orderMock.detail(id) : apiCall.get<OrderDto>(apiRoutes.orders.detail(id)),

  byCode: (code: string): Promise<OrderDto> =>
    isMockMode() ? orderMock.byCode(code) : apiCall.get<OrderDto>(apiRoutes.orders.byCode(encodeURIComponent(code))),

  nextCode: (): Promise<NextCodeDto> =>
    isMockMode() ? orderMock.nextCode() : apiCall.get<NextCodeDto>(apiRoutes.orders.nextCode),
}
