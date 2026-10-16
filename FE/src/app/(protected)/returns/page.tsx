import type { Metadata } from 'next'
import { ReturnsPage } from '@/features/returns/pages/ReturnsPage'

export const metadata: Metadata = { title: 'Đổi trả' }

export default function Page() {
  return <ReturnsPage />
}
