'use client'

import { useMutation, useQuery, type QueryClient } from '@tanstack/react-query'
import { posRules } from '@/config/pos-rules'
import { orderService } from '@/features/orders/services/order.service'
import { posService } from '../services/pos.service'

/** Query key 07 §4.7 */
export const posKeys = {
  catalog: ['pos-catalog'] as const,
  storeProfile: ['store-profile'] as const,
}

/** Danh mục máy bán hàng: làm mới mỗi 5 phút và sau mỗi thanh toán, đổi trả (NFR-02) */
export function useCatalog(enabled = true) {
  return useQuery({
    queryKey: posKeys.catalog,
    queryFn: posService.catalog,
    staleTime: posRules.catalogRefreshMs,
    refetchInterval: posRules.catalogRefreshMs,
    enabled,
  })
}

export function useStoreProfile() {
  return useQuery({ queryKey: posKeys.storeProfile, queryFn: posService.storeProfile, staleTime: 60_000 })
}

export const useQuote = () => useMutation({ mutationFn: orderService.quote })
export const useCheckout = () => useMutation({ mutationFn: orderService.checkout })

/** Làm mới sau thanh toán, đổi trả (07 §4.7) */
export function invalidateAfterSale(qc: QueryClient) {
  for (const key of [
    'pos-catalog',
    'shift-current',
    'orders',
    'order',
    'returns',
    'return',
    'stock',
    'stock-summary',
    'stock-lots',
    'stock-movements',
    'products',
    'product',
    'reports',
    'customers',
    'shifts',
    'shift',
  ]) {
    void qc.invalidateQueries({ queryKey: [key] })
  }
}
