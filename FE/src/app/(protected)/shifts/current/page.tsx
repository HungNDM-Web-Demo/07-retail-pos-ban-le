import type { Metadata } from 'next'
import { CurrentShiftPage } from '@/features/shifts/pages/CurrentShiftPage'

export const metadata: Metadata = { title: 'Ca của tôi' }

export default function Page() {
  return <CurrentShiftPage />
}
