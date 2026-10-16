import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Package,
  ReceiptText,
  ScanBarcode,
  Truck,
  Undo2,
  UserRound,
  Wallet,
} from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavGroup } from './index'

/**
 * Menu nghiệp vụ (docs/07-DANH-SACH-API.md §4.1). Thu ngân không có reports.view nên trang chủ rơi xuống
 * mục đầu tiên có quyền là Bán hàng (TC-43). /pos mở toàn màn hình (app/(pos)), không sidebar.
 */
export const mainRoutes: NavGroup = {
  id: 'main',
  items: [
    {
      title: 'Tổng quan',
      href: routePath.dashboard,
      icon: LayoutDashboard,
      permission: permissions.reports.view,
      description: 'Doanh thu, lãi gộp hôm nay, hàng sắp hết, lô sắp hết hạn',
    },
    {
      title: 'Bán hàng',
      href: routePath.pos,
      icon: ScanBarcode,
      permission: permissions.orders.create,
      description: 'Quét mã vạch tính tiền, hóa đơn chờ, thanh toán',
    },
    {
      title: 'Hóa đơn',
      href: routePath.orders,
      icon: ReceiptText,
      permission: permissions.orders.view,
      description: 'Tra cứu, in lại hóa đơn',
    },
    {
      title: 'Đổi trả',
      href: routePath.returns,
      icon: Undo2,
      permission: permissions.returns.view,
      description: 'Lập, tra cứu phiếu đổi trả',
    },
    {
      title: 'Ca của tôi',
      href: routePath.shiftsCurrent,
      icon: Wallet,
      permission: permissions.shifts.operate,
      hideWhen: permissions.shifts.view,
      description: 'Mở ca, chốt ca, báo cáo ca',
    },
    {
      title: 'Ca làm',
      href: routePath.shifts,
      icon: ClipboardList,
      permission: permissions.shifts.view,
      description: 'Danh sách ca, kiểm tra ca lệch tiền',
    },
  ],
}

/** Nhóm Kho hàng */
export const inventoryRoutes: NavGroup = {
  id: 'inventory',
  label: 'Kho hàng',
  items: [
    {
      title: 'Hàng hóa',
      href: routePath.products,
      icon: Package,
      permission: [permissions.products.create, permissions.products.update],
      description: 'Mặt hàng, đơn vị quy đổi, mã vạch, giá, nhóm hàng',
    },
    {
      title: 'Tồn kho',
      href: routePath.stock,
      icon: Boxes,
      permission: permissions.stockLevels.view,
      description: 'Tồn, giá trị tồn, sắp hết hạn, điều chỉnh tồn',
    },
    {
      title: 'Nhập hàng',
      href: routePath.goodsReceipts,
      icon: Truck,
      permission: permissions.goodsReceipts.view,
      description: 'Phiếu nhập, nhà cung cấp, giá vốn bình quân',
    },
  ],
}

/** Nhóm Kinh doanh */
export const businessRoutes: NavGroup = {
  id: 'business',
  label: 'Kinh doanh',
  items: [
    {
      title: 'Báo cáo',
      href: routePath.reports,
      icon: BarChart3,
      permission: permissions.reports.view,
      description: 'Doanh thu, lợi nhuận gộp theo ngày, nhóm, mặt hàng',
    },
    {
      title: 'Khách hàng',
      href: routePath.customers,
      icon: UserRound,
      permission: permissions.customers.view,
      description: 'Khách thân thiết, điểm tích lũy',
    },
  ],
}
