/** Endpoint BE (QUY-UOC-API §3). Đường dẫn tương đối, lib/axios.ts ghép với NEXT_PUBLIC_API_URL. */
export const apiRoutes = {
  auth: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    changePassword: '/api/auth/me/password',
  },
  demo: {
    accounts: '/api/demo/accounts',
    loginAs: '/api/demo/login-as',
    reset: '/api/demo/reset',
  },
  users: {
    list: '/api/users',
    detail: (id: string) => `/api/users/${id}`,
    lock: (id: string) => `/api/users/${id}/lock`,
    resetPassword: (id: string) => `/api/users/${id}/reset-password`,
  },
  roles: {
    list: '/api/roles',
    detail: (id: string) => `/api/roles/${id}`,
    permissions: (id: string) => `/api/roles/${id}/permissions`,
  },
  permissions: {
    list: '/api/permissions',
  },
  settings: {
    public: '/api/settings/public',
    list: '/api/settings',
  },
  uploads: {
    images: '/api/uploads/images',
  },
  auditLogs: {
    list: '/api/audit-logs',
  },

  // ---------------- Nghiệp vụ (docs/07-DANH-SACH-API.md §2)
  productGroups: {
    list: '/api/product-groups',
    detail: (id: string) => `/api/product-groups/${id}`,
    visibility: (id: string) => `/api/product-groups/${id}/visibility`,
    order: '/api/product-groups/order',
  },
  products: {
    list: '/api/products',
    detail: (id: string) => `/api/products/${id}`,
    status: (id: string) => `/api/products/${id}/status`,
    prices: (id: string) => `/api/products/${id}/prices`,
    lookup: '/api/products/lookup', // ?barcode=
    internalBarcode: '/api/products/internal-barcode',
  },
  pos: {
    catalog: '/api/pos/catalog',
  },
  orders: {
    list: '/api/orders',
    detail: (id: string) => `/api/orders/${id}`,
    byCode: (code: string) => `/api/orders/by-code/${code}`,
    quote: '/api/orders/quote',
    nextCode: '/api/orders/next-code',
  },
  approvals: {
    create: '/api/approvals',
  },
  returns: {
    list: '/api/returns',
    detail: (id: string) => `/api/returns/${id}`,
    source: '/api/returns/source', // ?code=
    sourceOrders: '/api/returns/source-orders',
  },
  shifts: {
    list: '/api/shifts',
    detail: (id: string) => `/api/shifts/${id}`,
    current: '/api/shifts/current',
    close: '/api/shifts/current/close',
    review: (id: string) => `/api/shifts/${id}/review`,
  },
  stock: {
    list: '/api/stock',
    summary: '/api/stock/summary',
    lots: '/api/stock/lots',
    movements: (productId: string) => `/api/stock/${productId}/movements`,
  },
  stockAdjustments: {
    list: '/api/stock-adjustments',
    detail: (id: string) => `/api/stock-adjustments/${id}`,
  },
  suppliers: {
    list: '/api/suppliers',
    detail: (id: string) => `/api/suppliers/${id}`,
  },
  goodsReceipts: {
    list: '/api/goods-receipts',
    detail: (id: string) => `/api/goods-receipts/${id}`,
    confirm: (id: string) => `/api/goods-receipts/${id}/confirm`,
  },
  reports: {
    dashboard: '/api/reports/dashboard',
    revenue: '/api/reports/revenue',
    groups: '/api/reports/groups',
    products: '/api/reports/products',
    returns: '/api/reports/returns',
    cashiers: '/api/reports/cashiers',
    paymentMethods: '/api/reports/payment-methods',
  },
  customers: {
    list: '/api/customers',
    detail: (id: string) => `/api/customers/${id}`,
    byPhone: (phone: string) => `/api/customers/by-phone/${phone}`,
    orders: (id: string) => `/api/customers/${id}/orders`,
  },
  storeProfile: '/api/store-profile',
} as const
