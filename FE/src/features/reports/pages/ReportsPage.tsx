'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { CashiersTab } from '../components/CashiersTab'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { GroupsTab } from '../components/GroupsTab'
import { PaymentMethodsTab } from '../components/PaymentMethodsTab'
import { ProductRankTab } from '../components/ProductRankTab'
import { ReturnsReportTab } from '../components/ReturnsReportTab'
import { RevenueTab } from '../components/RevenueTab'
import { DEFAULT_PRESET, presetRange, type DateRange, type RangePreset } from '../lib/date-range'

const TABS = [
  { value: 'revenue', label: 'Doanh thu', Tab: RevenueTab },
  { value: 'groups', label: 'Lợi nhuận theo nhóm', Tab: GroupsTab },
  { value: 'products', label: 'Theo mặt hàng', Tab: ProductRankTab },
  { value: 'returns', label: 'Đổi trả, hàng lỗi', Tab: ReturnsReportTab },
  { value: 'cashiers', label: 'Thu ngân', Tab: CashiersTab },
  { value: 'payments', label: 'Phương thức', Tab: PaymentMethodsTab },
] as const

/**
 * SCR-13 Báo cáo (UC-15, FR-36…FR-39): một khoảng ngày cho mọi tab (mặc định 30 ngày, chặn quá 366 ngày trước khi
 * gọi API), mỗi tab chỉ tải khi đang mở, xuất Excel từ dữ liệu đang xem. `?tab=groups` mở sẵn tab.
 */
export function ReportsPage() {
  const search = useSearchParams()
  const initialTab = TABS.some((t) => t.value === search.get('tab')) ? search.get('tab')! : 'revenue'
  const [tab, setTab] = useState(initialTab)
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET)
  const [range, setRange] = useState<DateRange>(() => presetRange(DEFAULT_PRESET))

  return (
    <PermissionGuard permission={permissions.reports.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Báo cáo"
          icon={BarChart3}
          description="Doanh thu thuần, lợi nhuận gộp theo ngày, nhóm hàng, mặt hàng; đổi trả, hàng lỗi; thu ngân, phương thức thanh toán."
        />
        <DateRangeFilter
          preset={preset}
          value={range}
          onChange={(p, r) => {
            setPreset(p)
            setRange(r)
          }}
        />
        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <div className="overflow-x-auto">
            <TabsList>
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {TABS.map(({ value, Tab }) => (
            <TabsContent key={value} value={value}>
              {tab === value && <Tab range={range} enabled />}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
