import type { Metadata } from 'next'
import { GoodsReceiptEditorPage } from '@/features/goods-receipts/pages/GoodsReceiptEditorPage'

export const metadata: Metadata = { title: 'Tạo phiếu nhập' }

export default function Page() {
  return <GoodsReceiptEditorPage />
}
