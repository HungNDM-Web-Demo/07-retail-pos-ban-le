'use client'

import { useParams } from 'next/navigation'
import { paymentMethodLabels, shiftStatusLabels } from '@/config/retail-pos-labels'
import { PrintSheet, ReceiptHeader, ReprintMark, Row, Rule } from '@/features/pos/components/PrintSheet'
import { useStoreProfile } from '@/features/pos/hooks/use-pos'
import { vnFormatDateTime } from '@/features/pos/lib/vn-time'
import { getErrorMessage } from '@/lib/api-error'
import { formatNumber } from '@/lib/format'
import { useShiftDetail } from '../hooks/use-shifts'

const n = (v: number) => formatNumber(v, 0)

/** Bản in báo cáo ca khổ 80 mm (SCR-04, UC-09 bước 6) */
export function ShiftReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const detail = useShiftDetail(id)
  const store = useStoreProfile()
  const s = detail.data
  return (
    <PrintSheet paperSize="80" ready={!!s && !!store.data} error={detail.error ? getErrorMessage(detail.error) : null}>
      {s && (
        <>
          <ReceiptHeader store={store.data} title="BÁO CÁO CA" />
          <ReprintMark />
          <Row label="Ca:" value={<strong>{s.code}</strong>} />
          <Row label="Thu ngân:" value={s.cashierName} />
          <Row label="Mở ca:" value={vnFormatDateTime(s.openedAt)} />
          {s.closedAt && <Row label="Chốt ca:" value={vnFormatDateTime(s.closedAt)} />}
          <Row label="Trạng thái:" value={shiftStatusLabels[s.status]} />
          <Rule />
          <Row label="Số hóa đơn" value={s.orderCount} />
          <Row label="Số phiếu đổi trả" value={s.returnCount} />
          {(['TienMat', 'ChuyenKhoan', 'The', 'BuTruDoiHang'] as const).map((m) => (
            <Row key={m} label={`Thu ${paymentMethodLabels[m].toLowerCase()}`} value={n(s.salesByMethod[m] ?? 0)} />
          ))}
          <Row label="Tổng bán" value={n(s.salesTotal)} />
          <Row label="Hoàn tiền mặt" value={n(s.refundByMethod.TienMat)} />
          <Row label="Hoàn chuyển khoản" value={n(s.refundByMethod.ChuyenKhoan)} />
          <Row label="Bù trừ đổi hàng" value={n(s.refundByMethod.BuTruDoiHang)} />
          <Row label="Doanh thu thuần" value={n(s.netRevenue)} strong />
          <Rule />
          <Row label="Tiền đầu ca" value={n(s.openingCash)} />
          <Row label="Tiền mặt lý thuyết" value={n(s.expectedCash)} />
          {s.countedCash !== undefined && s.countedCash !== null && (
            <>
              <Row label="Tiền thực đếm" value={n(s.countedCash)} />
              <Row label="Chênh lệch" value={n(s.difference ?? 0)} strong />
            </>
          )}
          {!!s.cashCount?.length && (
            <>
              <Rule />
              <p className="font-semibold">Đếm tiền</p>
              {s.cashCount.map((c) => (
                <Row key={c.denomination} label={`${n(c.denomination)} × ${c.count}`} value={n(c.denomination * c.count)} />
              ))}
            </>
          )}
          {s.note && <p className="mt-1">Ghi chú: {s.note}</p>}
          {s.reviewNote && (
            <p className="mt-1">
              Kiểm tra ({s.reviewedByName}): {s.reviewNote}
            </p>
          )}
          <Rule />
          <div className="mt-2 grid grid-cols-2 text-center">
            <p>Thu ngân</p>
            <p>Chủ cửa hàng</p>
          </div>
          <div className="h-12" />
        </>
      )}
    </PrintSheet>
  )
}
