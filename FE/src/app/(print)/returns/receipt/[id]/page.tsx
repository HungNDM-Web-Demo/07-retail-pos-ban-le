import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ReturnReceiptPage } from '@/features/returns/pages/ReturnReceiptPage'

export const metadata: Metadata = { title: 'In phiếu đổi trả' }

export default function Page() {
  return (
    <Suspense>
      <ReturnReceiptPage />
    </Suspense>
  )
}
