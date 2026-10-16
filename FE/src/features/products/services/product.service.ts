import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  InternalBarcodeDto,
  ProductDto,
  ProductGroupDto,
  ProductLookupDto,
  ProductQuery,
  ProductStatus,
  SaveProductGroupRequest,
  SaveProductRequest,
  UpdateProductPricesRequest,
} from '@/types/retail-pos'
import { productGroupMock, productMock } from '../mock/product.mock'

/** Nhóm hàng (07 §2.1) */
export const productGroupService = {
  list: (): Promise<ProductGroupDto[]> =>
    isMockMode() ? productGroupMock.list() : apiCall.get(apiRoutes.productGroups.list),

  create: (input: SaveProductGroupRequest): Promise<ProductGroupDto> =>
    isMockMode() ? productGroupMock.create(input) : apiCall.post(apiRoutes.productGroups.list, input),

  update: (id: string, input: SaveProductGroupRequest): Promise<ProductGroupDto> =>
    isMockMode()
      ? productGroupMock.update(id, input)
      : apiCall.put(apiRoutes.productGroups.detail(id), input),

  setVisibility: (id: string, isHidden: boolean): Promise<void> =>
    isMockMode()
      ? productGroupMock.setVisibility(id, isHidden)
      : apiCall.patch(apiRoutes.productGroups.visibility(id), { isHidden }),

  reorder: (ids: string[]): Promise<void> =>
    isMockMode() ? productGroupMock.reorder(ids) : apiCall.put(apiRoutes.productGroups.order, { ids }),
}

/** Hàng hóa (07 §2.2) */
export const productService = {
  list: (query: ProductQuery): Promise<PaginatedResult<ProductDto>> =>
    isMockMode() ? productMock.list(query) : apiCall.get(apiRoutes.products.list, { params: query }),

  get: (id: string): Promise<ProductDto> =>
    isMockMode() ? productMock.get(id) : apiCall.get(apiRoutes.products.detail(id)),

  /** Nhiều mặt hàng theo id (bản in tem); API gọi từng mặt hàng */
  getMany: (ids: string[]): Promise<ProductDto[]> =>
    isMockMode()
      ? productMock.getMany(ids)
      : Promise.all(ids.map((id) => apiCall.get<ProductDto>(apiRoutes.products.detail(id)))),

  lookup: (barcode: string): Promise<ProductLookupDto> =>
    isMockMode()
      ? productMock.lookup(barcode)
      : apiCall.get(apiRoutes.products.lookup, { params: { barcode } }),

  create: (input: SaveProductRequest): Promise<ProductDto> =>
    isMockMode() ? productMock.create(input) : apiCall.post(apiRoutes.products.list, input),

  update: (id: string, input: SaveProductRequest): Promise<ProductDto> =>
    isMockMode() ? productMock.update(id, input) : apiCall.put(apiRoutes.products.detail(id), input),

  setStatus: (id: string, status: ProductStatus): Promise<void> =>
    isMockMode()
      ? productMock.setStatus(id, status)
      : apiCall.patch(apiRoutes.products.status(id), { status }),

  updatePrices: (id: string, input: UpdateProductPricesRequest): Promise<ProductDto> =>
    isMockMode()
      ? productMock.updatePrices(id, input)
      : apiCall.patch(apiRoutes.products.prices(id), input),

  remove: (id: string): Promise<void> =>
    isMockMode() ? productMock.remove(id) : apiCall.delete(apiRoutes.products.detail(id)),

  internalBarcode: (): Promise<InternalBarcodeDto> =>
    isMockMode() ? productMock.internalBarcode() : apiCall.post(apiRoutes.products.internalBarcode),
}
