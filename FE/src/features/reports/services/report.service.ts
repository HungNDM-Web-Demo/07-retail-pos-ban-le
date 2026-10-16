import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  CashierReportRow,
  DashboardDto,
  DateRangeQuery,
  GroupProfitReport,
  PaymentMethodReportRow,
  ProductProfitQuery,
  ProductProfitRow,
  ReturnReason,
  ReturnsReport,
  RevenueReport,
} from '@/types/retail-pos'
import { reportsMock } from '../mock/reports.mock'

export type ReturnsReportQuery = DateRangeQuery & { reason?: ReturnReason }

/** Tổng quan và báo cáo (07 §2.10) */
export const reportService = {
  dashboard: (): Promise<DashboardDto> =>
    isMockMode() ? reportsMock.dashboard() : apiCall.get(apiRoutes.reports.dashboard),

  revenue: (q: DateRangeQuery): Promise<RevenueReport> =>
    isMockMode() ? reportsMock.revenue(q) : apiCall.get(apiRoutes.reports.revenue, { params: q }),

  groups: (q: DateRangeQuery): Promise<GroupProfitReport> =>
    isMockMode() ? reportsMock.groups(q) : apiCall.get(apiRoutes.reports.groups, { params: q }),

  products: (q: ProductProfitQuery): Promise<PaginatedResult<ProductProfitRow>> =>
    isMockMode() ? reportsMock.products(q) : apiCall.get(apiRoutes.reports.products, { params: q }),

  returns: (q: ReturnsReportQuery): Promise<ReturnsReport> =>
    isMockMode() ? reportsMock.returns(q) : apiCall.get(apiRoutes.reports.returns, { params: q }),

  cashiers: (q: DateRangeQuery): Promise<CashierReportRow[]> =>
    isMockMode() ? reportsMock.cashiers(q) : apiCall.get(apiRoutes.reports.cashiers, { params: q }),

  paymentMethods: (q: DateRangeQuery): Promise<PaymentMethodReportRow[]> =>
    isMockMode() ? reportsMock.paymentMethods(q) : apiCall.get(apiRoutes.reports.paymentMethods, { params: q }),
}
