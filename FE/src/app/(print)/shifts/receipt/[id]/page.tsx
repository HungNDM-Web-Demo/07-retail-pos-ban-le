import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ShiftReceiptPage } from '@/features/shifts/pages/ShiftReceiptPage'

export const metadata: Metadata = { title: 'Báo cáo ca' }

export default function Page() {
  return (
    <Suspense>
      <ShiftReceiptPage />
    </Suspense>
  )
}
