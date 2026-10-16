'use client'

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import type { ReturnQuery, ReturnSourceQuery } from '@/types/retail-pos'
import { returnService } from '../services/return.service'

/** Query key 07 §4.7 */
export const returnKeys = {
  list: (query: ReturnQuery) => ['returns', query] as const,
  detail: (id: string) => ['return', id] as const,
  sourceOrders: (query: ReturnSourceQuery) => ['return-source-orders', query] as const,
}

export function useReturns(query: ReturnQuery) {
  return useQuery({ queryKey: returnKeys.list(query), queryFn: () => returnService.list(query), placeholderData: keepPreviousData })
}

export function useReturn(id: string | null | undefined) {
  return useQuery({ queryKey: returnKeys.detail(id ?? ''), queryFn: () => returnService.detail(id!), enabled: !!id })
}

export function useSourceOrders(query: ReturnSourceQuery, enabled: boolean) {
  return useQuery({
    queryKey: returnKeys.sourceOrders(query),
    queryFn: () => returnService.sourceOrders(query),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export const useReturnSource = () => useMutation({ mutationFn: returnService.source })
export const useCreateReturn = () => useMutation({ mutationFn: returnService.create })
