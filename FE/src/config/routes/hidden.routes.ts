import { Printer, ReceiptText, Tag, Undo2, UserRound } from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavItem } from './index'

/** Trang không nằm trong menu nhưng cần tiêu đề trên Header và kiểm tra quyền. */
export const hiddenRoutes: NavItem[] = [
  {
    title: 'Hồ sơ cá nhân',
    href: routePath.profile,
    icon: UserRound,
  },
  // Lập phiếu đổi trả tại quầy (app/(pos), toàn màn hình; docs/07 §4.3)
  {
    title: 'Lập phiếu đổi trả',
    href: routePath.returnNew,
    icon: Undo2,
    permission: permissions.returns.create,
  },
  // Bản in (route group app/(print), có AuthGuard, không sidebar; docs/07 §4.6)
  {
    title: 'Hóa đơn',
    href: routePath.orderReceipt,
    icon: ReceiptText,
    permission: permissions.orders.view,
  },
  {
    title: 'Phiếu đổi trả',
    href: routePath.returnReceipt,
    icon: Undo2,
    permission: permissions.returns.view,
  },
  {
    title: 'Báo cáo ca',
    href: routePath.shiftReceipt,
    icon: Printer,
    permission: [permissions.shifts.operate, permissions.shifts.view],
  },
  {
    title: 'In tem mã vạch',
    href: routePath.productLabels,
    icon: Tag,
    permission: permissions.products.update,
  },
]
