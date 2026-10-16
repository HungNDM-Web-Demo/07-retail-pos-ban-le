'use client'

import { useParams } from 'next/navigation'
import { refundMethodLabels, returnConditionLabels, returnReasonLabels } from '@/config/retail-pos-labels'
import { BarcodeSvg } from '@/features/pos/components/BarcodeSvg'
import { PrintSheet, ReceiptHeader, ReprintMark, Row, Rule } from '@/features/pos/components/PrintSheet'
import { useStoreProfile } from '@/features/pos/hooks/use-pos'
import { vnFormatDateTime } from '@/features/pos/lib/vn-time'
import { getErrorMessage } from '@/lib/api-error'
import { formatNumber } from '@/lib/format'
import { useReturn } from '../hooks/use-returns'

const n = (v: number) => formatNumber(v, 0)

/** Bản in phiếu đổi trả (SCR-04, FR-26): hóa đơn gốc, dòng trả, tiền hoàn, bù trừ đổi hàng, khách ký nhận */
export function ReturnReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const query = useReturn(id)
  const store = useStoreProfile()
  const r = query.data
  return (
    <PrintSheet
      paperSize={store.data?.paperSize ?? '80'}
      ready={!!r && !!store.data}
      error={query.error ? getErrorMessage(query.error) : null}
    >
      {r && (
        <>
          <ReceiptHeader store={store.data} title="PHIẾU ĐỔI TRẢ" />
          <ReprintMark />
          <Row label="Số:" value={<strong>{r.code}</strong>} />
          <Row label="Ngày:" value={vnFormatDateTime(r.createdAt)} />
          <Row label="Thu ngân:" value={r.cashierName} />
          <Row label="Hóa đơn gốc:" value={r.orderCode} />
          <Row label="Ngày mua:" value={vnFormatDateTime(r.orderPaidAt)} />
          <Rule />
          <ul className="grid gap-1">
            {r.lines.map((l) => (
              <li key={l.id}>
                <p className="font-semibold">{l.productName}</p>
                <Row label={`Trả ${l.quantity} ${l.unitName}`} value={n(l.refundAmount)} />
                <p>
                  {returnConditionLabels[l.condition]} · {returnReasonLabels[l.reason]}
                  {l.note ? ` · ${l.note}` : ''}
                </p>
              </li>
            ))}
          </ul>
          <Rule />
          <Row label="TIỀN HOÀN" value={n(r.refundTotal)} strong />
          {r.exchangeOrder && (
            <>
              <Row label={`Hàng đổi (${r.exchangeOrder.code})`} value={n(r.exchangeOrder.total)} />
              <Row label="Bù trừ đổi hàng" value={n(r.offsetAmount)} />
              <Row label={r.difference > 0 ? 'Khách trả thêm' : 'Chênh lệch'} value={n(r.difference)} />
            </>
          )}
          {r.payoutAmount > 0 && (
            <Row label={`Trả khách (${refundMethodLabels[r.refundMethod].toLowerCase()})`} value={n(r.payoutAmount)} />
          )}
          {r.approvedByName && <p className="mt-1">Chủ cửa hàng xác nhận: {r.approvedByName}</p>}
          {r.pointsDeducted > 0 && <p>Trừ điểm: {r.pointsDeducted}</p>}
          {r.note && <p>Ghi chú: {r.note}</p>}
          <Rule />
          <div className="my-2 flex justify-center">
            <BarcodeSvg value={r.code} height={36} width={1.3} fontSize={11} />
          </div>
          <div className="mt-2 grid grid-cols-2 text-center">
            <p>Khách ký nhận</p>
            <p>Thu ngân</p>
          </div>
          <div className="h-12" />
        </>
      )}
    </PrintSheet>
  )
}
