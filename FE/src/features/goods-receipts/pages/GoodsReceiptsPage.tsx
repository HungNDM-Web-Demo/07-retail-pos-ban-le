'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Truck } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { ReceiptsTab } from '../components/ReceiptsTab'
import { SuppliersTab } from '../components/SuppliersTab'

/** SCR-11 Nhập hàng: tab Phiếu nhập, Nhà cung cấp (`?tab=suppliers`) */
export function GoodsReceiptsPage() {
  const search = useSearchParams()
  const { can } = usePermissions()
  const [tab, setTab] = useState(search.get('tab') === 'suppliers' ? 'suppliers' : 'receipts')

  return (
    <PermissionGuard permission={permissions.goodsReceipts.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Nhập hàng"
          icon={Truck}
          description="Phiếu nhập từ nhà cung cấp. Xác nhận nhập kho tăng tồn và tính lại giá vốn bình quân gia quyền."
        />
        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <TabsList>
            <TabsTrigger value="receipts">Phiếu nhập</TabsTrigger>
            {can(permissions.suppliers.view) && <TabsTrigger value="suppliers">Nhà cung cấp</TabsTrigger>}
          </TabsList>
          <TabsContent value="receipts">
            <ReceiptsTab />
          </TabsContent>
          <TabsContent value="suppliers">
            <SuppliersTab />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
