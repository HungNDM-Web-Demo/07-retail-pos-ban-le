import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ShiftsPage } from '@/features/shift-review/pages/ShiftsPage'

export const metadata: Metadata = { title: 'Ca làm' }

export default function Page() {
  return (
    <Suspense>
      <ShiftsPage />
    </Suspense>
  )
}
