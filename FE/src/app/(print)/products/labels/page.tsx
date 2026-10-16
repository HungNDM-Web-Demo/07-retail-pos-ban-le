import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ProductLabelsPage } from '@/features/products/pages/ProductLabelsPage'

export const metadata: Metadata = { title: 'In tem mã vạch' }

export default function Page() {
  return (
    <Suspense>
      <ProductLabelsPage />
    </Suspense>
  )
}
