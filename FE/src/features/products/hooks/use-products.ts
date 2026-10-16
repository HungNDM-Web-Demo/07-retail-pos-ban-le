'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { ProductQuery, ProductStatus, SaveProductGroupRequest, SaveProductRequest, UpdateProductPricesRequest } from '@/types/retail-pos'
import { productGroupService, productService } from '../services/product.service'

/**
 * Query key theo 07 §4.7. Sửa hàng hóa, giá, nhóm: làm mới danh mục máy bán hàng, hàng hóa, tồn kho.
 */
export function invalidateCatalog(qc: QueryClient) {
  for (const key of ['pos-catalog', 'products', 'product', 'product-groups', 'stock', 'stock-summary', 'stock-lots', 'stock-movements']) {
    void qc.invalidateQueries({ queryKey: [key] })
  }
}

export function useProductGroups() {
  return useQuery({ queryKey: ['product-groups'], queryFn: productGroupService.list, staleTime: 60_000 })
}

export function useSaveProductGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SaveProductGroupRequest }) =>
      id ? productGroupService.update(id, input) : productGroupService.create(input),
    onSuccess: () => invalidateCatalog(qc),
  })
}

export function useSetGroupVisibility() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isHidden }: { id: string; isHidden: boolean }) => productGroupService.setVisibility(id, isHidden),
    onSuccess: () => invalidateCatalog(qc),
  })
}

export function useReorderGroups() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => productGroupService.reorder(ids),
    onSettled: () => invalidateCatalog(qc),
  })
}

export function useProducts(query: ProductQuery, enabled = true) {
  return useQuery({
    queryKey: ['products', query],
    queryFn: () => productService.list(query),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useProduct(id: string | null | undefined) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => productService.get(id!),
    enabled: !!id,
  })
}

export function useProductsByIds(ids: string[]) {
  return useQuery({
    queryKey: ['products', { ids }],
    queryFn: () => productService.getMany(ids),
    enabled: ids.length > 0,
  })
}

export function useSaveProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SaveProductRequest }) =>
      id ? productService.update(id, input) : productService.create(input),
    onSuccess: () => invalidateCatalog(qc),
  })
}

export function useSetProductStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProductStatus }) => productService.setStatus(id, status),
    onSuccess: () => invalidateCatalog(qc),
  })
}

export function useUpdateProductPrices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductPricesRequest }) => productService.updatePrices(id, input),
    onSuccess: () => invalidateCatalog(qc),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => productService.remove(id),
    onSuccess: () => invalidateCatalog(qc),
  })
}

export function useInternalBarcode() {
  return useMutation({ mutationFn: () => productService.internalBarcode() })
}
