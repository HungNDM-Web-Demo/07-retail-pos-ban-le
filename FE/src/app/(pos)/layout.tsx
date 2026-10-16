import { DemoToolbar } from '@/components/demo/DemoToolbar'
import { AuthGuard } from '@/features/auth/components/AuthGuard'

/**
 * Màn quầy toàn màn hình (07 §4.1): `/pos`, `/returns/new`. Không sidebar; trang tự vẽ `PosShell`
 * (thanh trên có tab hóa đơn chờ, mã vạch mẫu, loa, menu). Có thanh công cụ demo.
 */
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {children}
      <DemoToolbar />
    </AuthGuard>
  )
}
