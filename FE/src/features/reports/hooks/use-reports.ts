'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DateRangeQuery, ProductProfitQuery } from '@/types/retail-pos'
import { reportService, type ReturnsReportQuery } from '../services/report.service'

/** Query key `['reports', loại, query]` (07 §4.7); thanh toán, đổi trả, nhập kho làm mới cả nhóm `reports` */
export function useDashboard() {
  return useQuery({ queryKey: ['reports', 'dashboard'], queryFn: reportService.dashboard, refetchInterval: 60_000 })
}

export function useRevenueReport(q: DateRangeQuery, enabled = true) {
  return useQuery({ queryKey: ['reports', 'revenue', q], queryFn: () => reportService.revenue(q), enabled, placeholderData: keepPreviousData })
}

export function useGroupReport(q: DateRangeQuery, enabled = true) {
  return useQuery({ queryKey: ['reports', 'groups', q], queryFn: () => reportService.groups(q), enabled, placeholderData: keepPreviousData })
}

export function useProductReport(q: ProductProfitQuery, enabled = true) {
  return useQuery({ queryKey: ['reports', 'products', q], queryFn: () => reportService.products(q), enabled, placeholderData: keepPreviousData })
}

export function useReturnsReport(q: ReturnsReportQuery, enabled = true) {
  return useQuery({ queryKey: ['reports', 'returns', q], queryFn: () => reportService.returns(q), enabled, placeholderData: keepPreviousData })
}

export function useCashierReport(q: DateRangeQuery, enabled = true) {
  return useQuery({ queryKey: ['reports', 'cashiers', q], queryFn: () => reportService.cashiers(q), enabled, placeholderData: keepPreviousData })
}

export function usePaymentMethodReport(q: DateRangeQuery, enabled = true) {
  return useQuery({
    queryKey: ['reports', 'payment-methods', q],
    queryFn: () => reportService.paymentMethods(q),
    enabled,
    placeholderData: keepPreviousData,
  })
}
