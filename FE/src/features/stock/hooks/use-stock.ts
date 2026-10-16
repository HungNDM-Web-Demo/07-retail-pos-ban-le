'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateStockAdjustmentRequest, StockAdjustmentQuery, StockLotQuery, StockQuery } from '@/types/retail-pos'
import { invalidateCatalog } from '@/features/products/hooks/use-products'
import { stockAdjustmentService, stockService } from '../services/stock.service'

export function useStock(query: StockQuery) {
  return useQuery({ queryKey: ['stock', query], queryFn: () => stockService.list(query), placeholderData: keepPreviousData })
}

export function useStockSummary(query: Pick<StockQuery, 'groupId' | 'status' | 'includeInactive'>) {
  return useQuery({ queryKey: ['stock-summary', query], queryFn: () => stockService.summary(query), placeholderData: keepPreviousData })
}

export function useStockLots(query: StockLotQuery, enabled = true) {
  return useQuery({ queryKey: ['stock-lots', query], queryFn: () => stockService.lots(query), enabled })
}

export function useStockMovements(productId: string | null, query: { page: number; pageSize: number }) {
  return useQuery({
    queryKey: ['stock-movements', productId, query],
    queryFn: () => stockService.movements(productId!, query),
    enabled: !!productId,
    placeholderData: keepPreviousData,
  })
}

export function useStockAdjustments(query: StockAdjustmentQuery, enabled = true) {
  return useQuery({
    queryKey: ['stock-adjustments', query],
    queryFn: () => stockAdjustmentService.list(query),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useStockAdjustment(id: string | null) {
  return useQuery({ queryKey: ['stock-adjustment', id], queryFn: () => stockAdjustmentService.get(id!), enabled: !!id })
}

/** Lưu phiếu là áp dụng ngay (BR-28): làm mới tồn, lô, hàng hóa, danh mục máy bán hàng, báo cáo hàng hủy */
export function useCreateStockAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStockAdjustmentRequest) => stockAdjustmentService.create(input),
    onSuccess: () => {
      invalidateCatalog(qc)
      void qc.invalidateQueries({ queryKey: ['stock-adjustments'] })
      void qc.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}
