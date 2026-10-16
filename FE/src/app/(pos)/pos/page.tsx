import type { Metadata } from 'next'
import { PosPage } from '@/features/pos/pages/PosPage'

export const metadata: Metadata = { title: 'Bán hàng' }

export default function Page() {
  return <PosPage />
}
