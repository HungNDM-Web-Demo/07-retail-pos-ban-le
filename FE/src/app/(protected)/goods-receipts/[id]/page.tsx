import type { Metadata } from 'next'
import { GoodsReceiptEditorPage } from '@/features/goods-receipts/pages/GoodsReceiptEditorPage'

export const metadata: Metadata = { title: 'Phiếu nhập' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GoodsReceiptEditorPage id={id} />
}
