'use client'

import { useParams } from 'next/navigation'
import { paymentMethodLabels } from '@/config/retail-pos-labels'
import { BarcodeSvg } from '@/features/pos/components/BarcodeSvg'
import { PrintSheet, ReceiptHeader, ReprintMark, Row, Rule } from '@/features/pos/components/PrintSheet'
import { useStoreProfile } from '@/features/pos/hooks/use-pos'
import { vnFormatDateTime } from '@/features/pos/lib/vn-time'
import { getErrorMessage } from '@/lib/api-error'
import { formatNumber, formatPhone } from '@/lib/format'
import { useOrder } from '../hooks/use-orders'

const n = (v: number) => formatNumber(v, 0)

/**
 * Bản in hóa đơn bán hàng (SCR-04, FR-20): thông tin cửa hàng, mã, giờ, thu ngân, ca, dòng hàng, giảm giá,
 * tổng, phương thức, tiền khách đưa, tiền thối, khách và điểm, người xác nhận, lời chào, chính sách đổi trả,
 * mã vạch Code 128 của mã hóa đơn (quét để đổi trả).
 */
export function OrderReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const order = useOrder(id)
  const store = useStoreProfile()
  const o = order.data
  return (
    <PrintSheet
      paperSize={store.data?.paperSize ?? '80'}
      ready={!!o && !!store.data}
      error={order.error ? getErrorMessage(order.error) : null}
    >
      {o && (
        <>
          <ReceiptHeader store={store.data} title={o.exchangeForReturn ? 'HÓA ĐƠN ĐỔI HÀNG' : 'HÓA ĐƠN BÁN HÀNG'} />
          <ReprintMark />
          <div className="mt-1">
            <Row label="Số:" value={<strong>{o.code}</strong>} />
            <Row label="Ngày:" value={vnFormatDateTime(o.paidAt)} />
            <Row label="Thu ngân:" value={o.cashierName} />
            <Row label="Ca:" value={o.shiftCode} />
            {o.exchangeForReturn && <Row label="Đổi cho phiếu:" value={o.exchangeForReturn.code} />}
          </div>
          <Rule />
          <ul className="grid gap-1">
            {o.lines.map((l) => (
              <li key={l.id}>
                <p className="font-semibold">
                  {l.lineNo}. {l.productName}
                </p>
                <Row label={`${n(l.quantity)} ${l.unitName} × ${n(l.unitPrice)}`} value={n(l.amount)} />
                {l.discount && <Row label="  Giảm" value={`−${n(l.discount.amount)}`} />}
              </li>
            ))}
          </ul>
          <Rule />
          <Row label="Tổng tiền hàng" value={n(o.subtotal)} />
          {o.lineDiscountTotal > 0 && <Row label="Giảm giá dòng" value={`−${n(o.lineDiscountTotal)}`} />}
          {o.orderDiscount && (
            <Row
              label={`Giảm giá hóa đơn${o.orderDiscount.type === 'PhanTram' ? ` ${formatNumber(o.orderDiscount.value, 1)}%` : ''}`}
              value={`−${n(o.orderDiscount.amount)}`}
            />
          )}
          <Row label="TỔNG THANH TOÁN" value={n(o.total)} strong />
          {o.payments.map((p, i) => (
            <div key={i}>
              <Row label={paymentMethodLabels[p.method]} value={n(p.amount)} />
              {p.cashReceived !== undefined && p.cashReceived !== null && (
                <>
                  <Row label="  Khách đưa" value={n(p.cashReceived)} />
                  <Row label="  Tiền thối" value={n(p.changeAmount ?? 0)} />
                </>
              )}
              {p.reference && p.method === 'The' && <Row label="  Mã chuẩn chi" value={p.reference} />}
            </div>
          ))}
          {o.approvedByName && <p className="mt-1">Giảm giá do {o.approvedByName} xác nhận</p>}
          {o.customer && (
            <>
              <Rule />
              <Row label="Khách:" value={`${o.customer.name} · ${formatPhone(o.customer.phone)}`} />
              <Row label="Điểm cộng:" value={o.pointsEarned} />
            </>
          )}
          <Rule />
          <div className="my-2 flex justify-center">
            <BarcodeSvg value={o.code} height={42} width={1.3} fontSize={11} />
          </div>
          {store.data?.receiptFooter && <p className="text-center font-semibold">{store.data.receiptFooter}</p>}
          {store.data?.returnPolicy && <p className="mt-1 text-center">{store.data.returnPolicy}</p>}
        </>
      )}
    </PrintSheet>
  )
}
