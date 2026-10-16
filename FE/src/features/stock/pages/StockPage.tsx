'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Boxes } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { useProductGroups } from '@/features/products/hooks/use-products'
import type { StockItem, StockStatus } from '@/types/retail-pos'
import { AdjustmentDetailDialog } from '../components/AdjustmentDetailDialog'
import { AdjustmentFormDialog, type AdjustmentPreset } from '../components/AdjustmentFormDialog'
import { AdjustmentsTab } from '../components/AdjustmentsTab'
import { LotsTab } from '../components/LotsTab'
import { MovementSheet } from '../components/MovementSheet'
import { StockTab } from '../components/StockTab'

const STATUSES: StockStatus[] = ['AmKho', 'HetHang', 'SapHet', 'ConHang']
const TABS = ['stock', 'lots', 'adjustments'] as const

/**
 * SCR-10 Tồn kho (UC-12, UC-13): tab Tồn kho, Sắp hết hạn, Phiếu điều chỉnh.
 * Tổng quan bấm thẻ cảnh báo mở `/stock?status=SapHet` hoặc `/stock?tab=lots` (UC-11 4a).
 */
export function StockPage() {
  const search = useSearchParams()
  const groups = useProductGroups()
  const tabParam = search.get('tab')
  const [tab, setTab] = useState<string>(TABS.includes(tabParam as (typeof TABS)[number]) ? tabParam! : 'stock')
  const statusParam = search.get('status') as StockStatus | null
  const initialStatus = statusParam && STATUSES.includes(statusParam) ? statusParam : undefined

  const [movementItem, setMovementItem] = useState<StockItem | null>(null)
  const [adjustmentId, setAdjustmentId] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; preset: AdjustmentPreset | null }>({ open: false, preset: null })

  return (
    <PermissionGuard permission={permissions.stockLevels.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Tồn kho"
          icon={Boxes}
          description="Tồn theo đơn vị cơ bản và cách đọc thùng, lốc; giá trị tồn; lô sắp hết hạn; phiếu điều chỉnh."
        />
        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <TabsList>
            <TabsTrigger value="stock">Tồn kho</TabsTrigger>
            <TabsTrigger value="lots">Sắp hết hạn</TabsTrigger>
            <TabsTrigger value="adjustments">Phiếu điều chỉnh</TabsTrigger>
          </TabsList>
          <TabsContent value="stock">
            <StockTab
              groups={groups.data ?? []}
              initialStatus={initialStatus}
              onRowClick={setMovementItem}
              onAdjust={() => setForm({ open: true, preset: null })}
              onShowLots={() => setTab('lots')}
            />
          </TabsContent>
          <TabsContent value="lots">
            <LotsTab onDispose={(preset) => setForm({ open: true, preset })} />
          </TabsContent>
          <TabsContent value="adjustments">
            <AdjustmentsTab onOpen={setAdjustmentId} onCreate={() => setForm({ open: true, preset: null })} />
          </TabsContent>
        </Tabs>
      </div>
      <MovementSheet item={movementItem} onOpenChange={(o) => !o && setMovementItem(null)} onAdjustment={setAdjustmentId} />
      <AdjustmentDetailDialog id={adjustmentId} onOpenChange={(o) => !o && setAdjustmentId(null)} />
      <AdjustmentFormDialog
        open={form.open}
        preset={form.preset}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        onSaved={(adj) => {
          if (form.preset?.goodsReceiptLineId) setAdjustmentId(adj.id)
        }}
      />
    </PermissionGuard>
  )
}
