'use client'

import { useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Ban, ScanBarcode, ShoppingBasket } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { PosCatalog } from '@/types/retail-pos'
import { isScanListening, simulateScan, subscribeScanListening } from '../hooks/use-scanner'
import { posKeys } from '../hooks/use-pos'
import { randomBarcodes, TEST_BARCODES } from './SampleBarcodesDialog'

/** Mã không tồn tại (TC-15) */
const UNKNOWN_BARCODE = '8930000000000'

/**
 * Mục "Máy quét giả lập" của DemoToolbar (07 §4.2 mục 3): phát `pos:simulate-scan` tới màn đang nghe
 * (/pos, hộp F3, màn đổi trả, form phiếu nhập). Ngoài các màn đó nút khóa.
 */
export function ScannerDemoSection({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient()
  const listening = useSyncExternalStore(subscribeScanListening, isScanListening, () => false)
  const catalog = () => qc.getQueryData<PosCatalog>(posKeys.catalog)

  const scanRandom = () => {
    const [code] = randomBarcodes(catalog(), 1)
    if (!code) return toast.error('Chưa tải danh mục hàng')
    onDone?.()
    simulateScan(code)
  }

  const scanBasket = () => {
    // 5 mã liên tiếp cách 300 ms (kiểm NFR-02): 2 mã test case + 3 mã ngẫu nhiên
    const codes = [TEST_BARCODES[0], TEST_BARCODES[3], ...randomBarcodes(catalog(), 3, TEST_BARCODES)]
    onDone?.()
    codes.forEach((code, i) => setTimeout(() => simulateScan(code), i * 300))
  }

  return (
    <div className="grid gap-2">
      <Button variant="outline" className="h-10 justify-start" disabled={!listening} onClick={scanRandom}>
        <ScanBarcode aria-hidden="true" /> Quét mã ngẫu nhiên
      </Button>
      <Button variant="outline" className="h-10 justify-start" disabled={!listening} onClick={scanBasket}>
        <ShoppingBasket aria-hidden="true" /> Quét giỏ mẫu (5 mã)
      </Button>
      <Button
        variant="outline"
        className="h-10 justify-start"
        disabled={!listening}
        onClick={() => {
          onDone?.()
          simulateScan(UNKNOWN_BARCODE)
        }}
      >
        <Ban aria-hidden="true" /> Quét mã không tồn tại
      </Button>
      {!listening && <p className="text-muted-foreground text-xs">Mở màn Bán hàng để dùng</p>}
    </div>
  )
}
