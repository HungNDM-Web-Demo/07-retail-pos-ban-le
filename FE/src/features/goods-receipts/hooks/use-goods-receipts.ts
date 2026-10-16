'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { invalidateCatalog } from '@/features/products/hooks/use-products'
import type { GoodsReceiptQuery, SaveGoodsReceiptRequest, SaveSupplierRequest, SupplierQuery } from '@/types/retail-pos'
import { goodsReceiptService, supplierService } from '../services/goods-receipt.service'

const refreshReceipts = (qc: QueryClient) => {
  void qc.invalidateQueries({ queryKey: ['goods-receipts'] })
  void qc.invalidateQueries({ queryKey: ['goods-receipt'] })
  void qc.invalidateQueries({ queryKey: ['suppliers'] })
}

export function useSuppliers(query: SupplierQuery) {
  return useQuery({ queryKey: ['suppliers', query], queryFn: () => supplierService.list(query), placeholderData: keepPreviousData })
}

/** Mọi nhà cung cấp cho ô chọn (pageSize 100) */
export function useSupplierOptions() {
  return useSuppliers({ pageSize: 100, sortBy: 'name', sortDir: 'asc' })
}

export function useSaveSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SaveSupplierRequest }) =>
      id ? supplierService.update(id, input) : supplierService.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

export function useGoodsReceipts(query: GoodsReceiptQuery) {
  return useQuery({
    queryKey: ['goods-receipts', query],
    queryFn: () => goodsReceiptService.list(query),
    placeholderData: keepPreviousData,
  })
}

export function useGoodsReceipt(id: string | null | undefined) {
  return useQuery({ queryKey: ['goods-receipt', id], queryFn: () => goodsReceiptService.get(id!), enabled: !!id })
}

export function useSaveGoodsReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SaveGoodsReceiptRequest }) =>
      id ? goodsReceiptService.update(id, input) : goodsReceiptService.create(input),
    onSuccess: () => refreshReceipts(qc),
  })
}

export function useDeleteGoodsReceipt() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => goodsReceiptService.remove(id), onSuccess: () => refreshReceipts(qc) })
}

/** Xác nhận nhập kho: tồn, giá vốn đổi → làm mới hàng hóa, tồn, danh mục máy bán hàng, phiếu nhập */
export function useConfirmGoodsReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => goodsReceiptService.confirm(id),
    onSuccess: () => {
      refreshReceipts(qc)
      invalidateCatalog(qc)
    },
  })
}
