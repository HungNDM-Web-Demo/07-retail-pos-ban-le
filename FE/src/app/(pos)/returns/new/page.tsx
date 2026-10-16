import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ReturnNewPage } from '@/features/returns/pages/ReturnNewPage'

export const metadata: Metadata = { title: 'Lập phiếu đổi trả' }

export default function Page() {
  return (
    <Suspense>
      <ReturnNewPage />
    </Suspense>
  )
}
