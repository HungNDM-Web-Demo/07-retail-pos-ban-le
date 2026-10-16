import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  CreateReturnRequest,
  ReturnDto,
  ReturnListItem,
  ReturnQuery,
  ReturnSourceListItem,
  ReturnSourceOrder,
  ReturnSourceQuery,
} from '@/types/retail-pos'
import { returnMock } from '../mock/return.mock'

/** API `/api/returns` (07 §2.6) */
export const returnService = {
  source: (code: string): Promise<ReturnSourceOrder> =>
    isMockMode()
      ? returnMock.source(code)
      : apiCall.get<ReturnSourceOrder>(apiRoutes.returns.source, { params: { code } }),

  sourceOrders: (query: ReturnSourceQuery): Promise<PaginatedResult<ReturnSourceListItem>> =>
    isMockMode()
      ? returnMock.sourceOrders(query)
      : apiCall.get<PaginatedResult<ReturnSourceListItem>>(apiRoutes.returns.sourceOrders, { params: query }),

  create: (input: CreateReturnRequest): Promise<ReturnDto> =>
    isMockMode() ? returnMock.create(input) : apiCall.post<ReturnDto>(apiRoutes.returns.list, input),

  list: (query: ReturnQuery): Promise<PaginatedResult<ReturnListItem>> =>
    isMockMode()
      ? returnMock.list(query)
      : apiCall.get<PaginatedResult<ReturnListItem>>(apiRoutes.returns.list, { params: query }),

  detail: (id: string): Promise<ReturnDto> =>
    isMockMode() ? returnMock.detail(id) : apiCall.get<ReturnDto>(apiRoutes.returns.detail(id)),
}
