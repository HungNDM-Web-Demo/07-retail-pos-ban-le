import { Suspense } from 'react'
import type { Metadata } from 'next'
import { StockPage } from '@/features/stock/pages/StockPage'

export const metadata: Metadata = { title: 'Tồn kho' }

export default function Page() {
  return (
    <Suspense>
      <StockPage />
    </Suspense>
  )
}
