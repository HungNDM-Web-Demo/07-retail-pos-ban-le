'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Package } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import type { StockStatus } from '@/types/retail-pos'
import { ProductGroupsTab } from '../components/ProductGroupsTab'
import { ProductsTab } from '../components/ProductsTab'
import { useProductGroups } from '../hooks/use-products'

const STOCK_STATUSES: StockStatus[] = ['AmKho', 'HetHang', 'SapHet', 'ConHang']

/** SCR-09 Hàng hóa (UC-01): tab Mặt hàng, Nhóm hàng. `?tab=groups`, `?stockStatus=SapHet` mở sẵn. */
export function ProductsPage() {
  const search = useSearchParams()
  const groups = useProductGroups()
  const [tab, setTab] = useState(search.get('tab') === 'groups' ? 'groups' : 'products')
  const [groupFilter, setGroupFilter] = useState<{ id?: string; key: number }>({ key: 0 })
  const stockParam = search.get('stockStatus') as StockStatus | null
  const initialStockStatus = stockParam && STOCK_STATUSES.includes(stockParam) ? stockParam : undefined

  return (
    <PermissionGuard permission={[permissions.products.create, permissions.products.update]} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Hàng hóa"
          icon={Package}
          description="Mặt hàng, đơn vị quy đổi, mã vạch, giá bán và nhóm hàng. Giá vốn bình quân tự tính khi nhập kho."
        />
        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <TabsList>
            <TabsTrigger value="products">Mặt hàng</TabsTrigger>
            <TabsTrigger value="groups">Nhóm hàng</TabsTrigger>
          </TabsList>
          <TabsContent value="products">
            <ProductsTab
              key={groupFilter.key}
              groups={groups.data ?? []}
              initialGroupId={groupFilter.id}
              initialStockStatus={initialStockStatus}
            />
          </TabsContent>
          <TabsContent value="groups">
            <ProductGroupsTab
              groups={groups.data}
              isLoading={groups.isLoading}
              error={groups.error}
              onRetry={() => void groups.refetch()}
              onOpenGroup={(id) => {
                setGroupFilter((g) => ({ id, key: g.key + 1 }))
                setTab('products')
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
