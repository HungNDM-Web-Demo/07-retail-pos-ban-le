import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ReportsPage } from '@/features/reports/pages/ReportsPage'

export const metadata: Metadata = { title: 'Báo cáo' }

export default function Page() {
  return (
    <Suspense>
      <ReportsPage />
    </Suspense>
  )
}
