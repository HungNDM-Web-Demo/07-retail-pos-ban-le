import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { requirePermission, requireSession, type MockSessionContext } from '@/mock/mock-auth'
import type { PosCatalog, ReceiptPaperSize, StoreProfile } from '@/types/retail-pos'
import { toCatalog } from './mappers'
import { settingValue } from './pos.db'

/** Người gọi có quyền (ADMIN luôn có) */
export const hasPermission = (ctx: MockSessionContext, code: string): boolean =>
  ctx.isSuperAdmin || ctx.permissions.includes(code)

/** Người gọi được xem giá vốn (07 §1) */
export const canViewCost = (ctx: MockSessionContext): boolean => hasPermission(ctx, permissions.products.viewCost)

/** Thông tin cửa hàng từ cài đặt (07 §2.11) */
export function readStoreProfile(): StoreProfile {
  const v = (key: string, fallback = '') => settingValue(key) ?? fallback
  const paper = v('Pos.ReceiptPaperSize', '80')
  return {
    name: v('Store.Name', 'Bình An Mart'),
    address: v('Store.Address'),
    phone: v('Store.Phone'),
    taxCode: v('Store.TaxCode') || undefined,
    receiptFooter: v('Store.ReceiptFooter'),
    returnPolicy: v('Pos.ReturnPolicy'),
    paperSize: (paper === '58' ? '58' : '80') as ReceiptPaperSize,
    bankBin: v('Store.BankBin'),
    bankAccount: v('Store.BankAccount'),
    bankAccountName: v('Store.BankAccountName'),
    allowNegativeStock: v('Pos.AllowNegativeStock', 'true') !== 'false',
    defaultOpeningCash: Number(v('Pos.DefaultOpeningCash', '500000')) || 0,
    logoUrl: v('Brand.LogoUrl') || undefined,
  }
}

export const catalogMock = {
  /** GET /api/pos/catalog (07 §2.3) */
  async catalog(): Promise<PosCatalog> {
    await mockDelay(150, 300)
    requirePermission(permissions.orders.create)
    return toCatalog()
  },

  /** GET /api/store-profile */
  async storeProfile(): Promise<StoreProfile> {
    await mockDelay(80, 150)
    requireSession()
    return readStoreProfile()
  },
}
