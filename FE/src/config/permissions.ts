/**
 * Mã quyền, khai báo giống hệt BE `Application/Constants/Permissions.cs`
 * và danh sách seed `src/mock/seed/system.json` (+ project.json).
 * Định dạng `{resource}.{action}`. Không gõ chuỗi mã quyền trực tiếp trong component.
 */
export const permissions = {
  dashboard: {
    view: 'dashboard.view',
  },
  users: {
    view: 'users.view',
    create: 'users.create',
    update: 'users.update',
    delete: 'users.delete',
  },
  roles: {
    view: 'roles.view',
    create: 'roles.create',
    update: 'roles.update',
    delete: 'roles.delete',
  },
  settings: {
    view: 'settings.view',
    update: 'settings.update',
  },
  auditLogs: {
    view: 'audit-logs.view',
  },
  // Quyền nghiệp vụ (docs/07-DANH-SACH-API.md §1, project.json → permissions)
  products: {
    view: 'products.view',
    create: 'products.create',
    update: 'products.update',
    delete: 'products.delete',
    viewCost: 'products.view-cost',
  },
  orders: {
    create: 'orders.create',
    view: 'orders.view',
    discount: 'orders.discount',
    discountOverride: 'orders.discount-override',
    reprint: 'orders.reprint',
  },
  returns: {
    create: 'returns.create',
    view: 'returns.view',
    override: 'returns.override',
  },
  shifts: {
    operate: 'shifts.operate',
    view: 'shifts.view',
    review: 'shifts.review',
  },
  stockLevels: {
    view: 'stock-levels.view',
  },
  stockAdjustments: {
    create: 'stock-adjustments.create',
  },
  suppliers: {
    view: 'suppliers.view',
    create: 'suppliers.create',
    update: 'suppliers.update',
  },
  goodsReceipts: {
    view: 'goods-receipts.view',
    create: 'goods-receipts.create',
    update: 'goods-receipts.update',
    delete: 'goods-receipts.delete',
    confirm: 'goods-receipts.confirm',
  },
  reports: {
    view: 'reports.view',
  },
  customers: {
    view: 'customers.view',
    create: 'customers.create',
  },
} as const

/** Mã vai trò hệ thống (BR-SYS-06). */
export const roleCodes = {
  admin: 'ADMIN',
  manager: 'MANAGER',
  staff: 'STAFF',
  cashier: 'CASHIER',
} as const

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T]
export type PermissionCode = Leaves<typeof permissions>
