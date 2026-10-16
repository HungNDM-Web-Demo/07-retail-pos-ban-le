import type { Metadata } from 'next'
import { CustomersPage } from '@/features/customers/pages/CustomersPage'

export const metadata: Metadata = { title: 'Khách hàng' }

export default function Page() {
  return <CustomersPage />
}
