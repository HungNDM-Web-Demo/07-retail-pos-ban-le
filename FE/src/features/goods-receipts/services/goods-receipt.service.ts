import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  ConfirmGoodsReceiptResult,
  GoodsReceiptDto,
  GoodsReceiptListItem,
  GoodsReceiptQuery,
  SaveGoodsReceiptRequest,
  SaveSupplierRequest,
  SupplierDto,
  SupplierQuery,
} from '@/types/retail-pos'
import { goodsReceiptMock, supplierMock } from '../mock/goods-receipt.mock'

/** Nhà cung cấp (07 §2.9) */
export const supplierService = {
  list: (query: SupplierQuery): Promise<PaginatedResult<SupplierDto>> =>
    isMockMode() ? supplierMock.list(query) : apiCall.get(apiRoutes.suppliers.list, { params: query }),

  get: (id: string): Promise<SupplierDto> =>
    isMockMode() ? supplierMock.get(id) : apiCall.get(apiRoutes.suppliers.detail(id)),

  create: (input: SaveSupplierRequest): Promise<SupplierDto> =>
    isMockMode() ? supplierMock.create(input) : apiCall.post(apiRoutes.suppliers.list, input),

  update: (id: string, input: SaveSupplierRequest): Promise<SupplierDto> =>
    isMockMode() ? supplierMock.update(id, input) : apiCall.put(apiRoutes.suppliers.detail(id), input),
}

/** Phiếu nhập (07 §2.9, UC-14) */
export const goodsReceiptService = {
  list: (query: GoodsReceiptQuery): Promise<PaginatedResult<GoodsReceiptListItem>> =>
    isMockMode() ? goodsReceiptMock.list(query) : apiCall.get(apiRoutes.goodsReceipts.list, { params: query }),

  get: (id: string): Promise<GoodsReceiptDto> =>
    isMockMode() ? goodsReceiptMock.get(id) : apiCall.get(apiRoutes.goodsReceipts.detail(id)),

  create: (input: SaveGoodsReceiptRequest): Promise<GoodsReceiptDto> =>
    isMockMode() ? goodsReceiptMock.create(input) : apiCall.post(apiRoutes.goodsReceipts.list, input),

  update: (id: string, input: SaveGoodsReceiptRequest): Promise<GoodsReceiptDto> =>
    isMockMode() ? goodsReceiptMock.update(id, input) : apiCall.put(apiRoutes.goodsReceipts.detail(id), input),

  remove: (id: string): Promise<void> =>
    isMockMode() ? goodsReceiptMock.remove(id) : apiCall.delete(apiRoutes.goodsReceipts.detail(id)),

  confirm: (id: string): Promise<ConfirmGoodsReceiptResult> =>
    isMockMode() ? goodsReceiptMock.confirm(id) : apiCall.post(apiRoutes.goodsReceipts.confirm(id)),
}
