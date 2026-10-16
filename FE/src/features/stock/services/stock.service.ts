import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  CreateStockAdjustmentRequest,
  StockAdjustmentDto,
  StockAdjustmentListItem,
  StockAdjustmentQuery,
  StockItem,
  StockLotDto,
  StockLotQuery,
  StockMovementDto,
  StockQuery,
  StockSummary,
} from '@/types/retail-pos'
import { stockAdjustmentMock, stockMock } from '../mock/stock.mock'

type SummaryQuery = Pick<StockQuery, 'groupId' | 'status' | 'includeInactive'>
type PageQuery = { page?: number; pageSize?: number }

/** Tồn kho (07 §2.8) */
export const stockService = {
  list: (query: StockQuery): Promise<PaginatedResult<StockItem>> =>
    isMockMode() ? stockMock.list(query) : apiCall.get(apiRoutes.stock.list, { params: query }),

  summary: (query: SummaryQuery): Promise<StockSummary> =>
    isMockMode() ? stockMock.summary(query) : apiCall.get(apiRoutes.stock.summary, { params: query }),

  lots: (query: StockLotQuery): Promise<StockLotDto[]> =>
    isMockMode() ? stockMock.lots(query) : apiCall.get(apiRoutes.stock.lots, { params: query }),

  movements: (productId: string, query: PageQuery): Promise<PaginatedResult<StockMovementDto>> =>
    isMockMode()
      ? stockMock.movements(productId, query)
      : apiCall.get(apiRoutes.stock.movements(productId), { params: query }),
}

/** Phiếu điều chỉnh tồn (07 §2.8, UC-13) */
export const stockAdjustmentService = {
  list: (query: StockAdjustmentQuery): Promise<PaginatedResult<StockAdjustmentListItem>> =>
    isMockMode() ? stockAdjustmentMock.list(query) : apiCall.get(apiRoutes.stockAdjustments.list, { params: query }),

  get: (id: string): Promise<StockAdjustmentDto> =>
    isMockMode() ? stockAdjustmentMock.get(id) : apiCall.get(apiRoutes.stockAdjustments.detail(id)),

  create: (input: CreateStockAdjustmentRequest): Promise<StockAdjustmentDto> =>
    isMockMode() ? stockAdjustmentMock.create(input) : apiCall.post(apiRoutes.stockAdjustments.list, input),
}
