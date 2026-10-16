/** Đường dẫn FE (kebab-case). Không gõ đường dẫn trực tiếp trong component. */
export const routePath = {
  root: '/',
  login: '/login',
  forbidden: '/forbidden',
  profile: '/profile',

  dashboard: '/dashboard',

  // Bán hàng (FE-Bán hàng; /pos, /returns/new toàn màn hình trong app/(pos))
  pos: '/pos',
  orders: '/orders',
  returns: '/returns',
  returnNew: '/returns/new',
  shiftsCurrent: '/shifts/current',
  customers: '/customers',
  // Bản in (app/(print), không sidebar)
  orderReceipt: '/pos/receipt',
  returnReceipt: '/returns/receipt',
  shiftReceipt: '/shifts/receipt',

  // Quản lý (FE-Quản lý)
  shifts: '/shifts',
  products: '/products',
  productLabels: '/products/labels',
  stock: '/stock',
  goodsReceipts: '/goods-receipts',
  goodsReceiptNew: '/goods-receipts/new',
  reports: '/reports',

  settingsUsers: '/settings/users',
  settingsRoles: '/settings/roles',
  settingsGeneral: '/settings/general',
  settingsAuditLogs: '/settings/audit-logs',
} as const

export type RoutePath = (typeof routePath)[keyof typeof routePath]

/** Đường dẫn có tham số */
export const routeTo = {
  orderReceipt: (id: string) => `${routePath.orderReceipt}/${id}`,
  returnReceipt: (id: string) => `${routePath.returnReceipt}/${id}`,
  shiftReceipt: (id: string) => `${routePath.shiftReceipt}/${id}`,
  goodsReceipt: (id: string) => `${routePath.goodsReceipts}/${id}`,
} as const
