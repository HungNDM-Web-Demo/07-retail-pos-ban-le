'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Truck } from 'lucide-react'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { routePath, routeTo } from '@/config/route-path'
import type { ConfirmGoodsReceiptResult, LowMarginItem } from '@/types/retail-pos'
import { LowMarginDialog } from '../components/LowMarginDialog'
import { ReceiptForm } from '../components/ReceiptForm'
import { ReceiptView } from '../components/ReceiptView'
import { useGoodsReceipt } from '../hooks/use-goods-receipts'

/** SCR-12 Lập, xem phiếu nhập (`/goods-receipts/new`, `/goods-receipts/[id]`) */
export function GoodsReceiptEditorPage({ id }: { id?: string }) {
  const router = useRouter()
  const query = useGoodsReceipt(id)
  const [lowMargin, setLowMargin] = useState<LowMarginItem[]>([])
  const [confirmedId, setConfirmedId] = useState<string | null>(null)
  const r = query.data

  const onConfirmed = (result: ConfirmGoodsReceiptResult) => {
    setConfirmedId(result.receipt.id)
    if (result.lowMarginProducts.length) setLowMargin(result.lowMarginProducts)
    else if (!id) router.replace(routeTo.goodsReceipt(result.receipt.id))
  }

  const title = !id ? 'Tạo phiếu nhập' : r ? `Phiếu nhập ${r.code}` : 'Phiếu nhập'

  return (
    <PermissionGuard permission={id ? permissions.goodsReceipts.view : permissions.goodsReceipts.create} redirect>
      <div className="space-y-6">
        <PageHeader
          title={title}
          icon={Truck}
          description={
            r?.status === 'DaNhapKho'
              ? 'Đã nhập kho: tồn và giá vốn bình quân đã cập nhật.'
              : 'Lưu nháp chưa đổi tồn. Xác nhận nhập kho mới tăng tồn và tính lại giá vốn bình quân.'
          }
          actions={
            <Button variant="outline" asChild>
              <Link href={routePath.goodsReceipts}>
                <ArrowLeft aria-hidden="true" />
                Danh sách phiếu nhập
              </Link>
            </Button>
          }
        />
        {id && query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : id && !r ? (
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        ) : r?.status === 'DaNhapKho' ? (
          <ReceiptView receipt={r} />
        ) : (
          <ReceiptForm key={r?.id ?? 'new'} receipt={r ?? null} onConfirmed={onConfirmed} />
        )}
      </div>
      <LowMarginDialog
        key={confirmedId ?? 'none'}
        items={lowMargin}
        onClose={() => {
          setLowMargin([])
          if (!id && confirmedId) router.replace(routeTo.goodsReceipt(confirmedId))
        }}
      />
    </PermissionGuard>
  )
}
