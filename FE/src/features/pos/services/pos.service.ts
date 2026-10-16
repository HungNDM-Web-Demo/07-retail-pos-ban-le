import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PosCatalog, StoreProfile } from '@/types/retail-pos'
import { catalogMock } from '../mock/catalog.mock'

/** Danh mục máy bán hàng (07 §2.3), thông tin cửa hàng (07 §2.11) */
export const posService = {
  catalog: (): Promise<PosCatalog> =>
    isMockMode() ? catalogMock.catalog() : apiCall.get<PosCatalog>(apiRoutes.pos.catalog),

  storeProfile: (): Promise<StoreProfile> =>
    isMockMode() ? catalogMock.storeProfile() : apiCall.get<StoreProfile>(apiRoutes.storeProfile),
}
