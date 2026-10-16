import { AuthGuard } from '@/features/auth/components/AuthGuard'

/**
 * Bản in (07 §4.1, §4.4): cần đăng nhập, không khung trang. Trang in đặt `@page` riêng theo khổ giấy;
 * khi in chỉ còn nội dung `.print-area`, nền trắng chữ đen.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="print-root min-h-svh bg-white text-black">{children}</div>
      <style>{`
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-root { min-height: 0 !important; }
        }
      `}</style>
    </AuthGuard>
  )
}
