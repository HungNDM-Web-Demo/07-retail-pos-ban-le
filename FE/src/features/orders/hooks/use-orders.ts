'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { OrderQuery } from '@/types/retail-pos'
import { orderService } from '../services/order.service'

/** Query key 07 §4.7 */
export const orderKeys = {
  list: (query: OrderQuery) => ['orders', query] as const,
  detail: (id: string) => ['order', id] as const,
}

export function useOrders(query: OrderQuery) {
  return useQuery({ queryKey: orderKeys.list(query), queryFn: () => orderService.list(query), placeholderData: keepPreviousData })
}

export function useOrder(id: string | null | undefined) {
  return useQuery({ queryKey: orderKeys.detail(id ?? ''), queryFn: () => orderService.detail(id!), enabled: !!id })
}
