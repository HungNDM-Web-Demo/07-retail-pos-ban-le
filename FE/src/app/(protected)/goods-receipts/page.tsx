import { Suspense } from 'react'
import type { Metadata } from 'next'
import { GoodsReceiptsPage } from '@/features/goods-receipts/pages/GoodsReceiptsPage'

export const metadata: Metadata = { title: 'Nhập hàng' }

export default function Page() {
  return (
    <Suspense>
      <GoodsReceiptsPage />
    </Suspense>
  )
}
