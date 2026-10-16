import { Suspense } from 'react'
import type { Metadata } from 'next'
import { OrderReceiptPage } from '@/features/orders/pages/OrderReceiptPage'

export const metadata: Metadata = { title: 'In hóa đơn' }

export default function Page() {
  return (
    <Suspense>
      <OrderReceiptPage />
    </Suspense>
  )
}
