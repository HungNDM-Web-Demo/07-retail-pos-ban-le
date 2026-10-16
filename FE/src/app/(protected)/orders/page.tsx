import type { Metadata } from 'next'
import { OrdersPage } from '@/features/orders/pages/OrdersPage'

export const metadata: Metadata = { title: 'Hóa đơn' }

export default function Page() {
  return <OrdersPage />
}
