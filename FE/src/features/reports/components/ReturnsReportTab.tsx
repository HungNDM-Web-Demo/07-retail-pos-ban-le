'use client'

import { useState } from 'react'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { adjustmentReasonLabels, returnReasonLabels } from '@/config/retail-pos-labels'
import { FilterSelect } from '@/features/products/components/FilterSelect'
import { formatNumber, formatVnd } from '@/lib/format'
import type { ReturnReason } from '@/types/retail-pos'
import { useReturnsReport } from '../hooks/use-reports'
import { displayDateKey } from '../lib/date-range'
import { excelSheet, reportFileName } from '../lib/export-excel'
import { ExportButton, Stat, TabLoading, type ReportTabProps } from './ReportParts'

/**
 * Tab Đổi trả và hàng lỗi (FR-38, BR-30): số phiếu, tiền hoàn theo lý do, sổ hàng lỗi (dòng trả Hàng lỗi, giá trị theo
 * giá vốn dòng gốc), hàng hủy qua phiếu điều chỉnh. Hàng lỗi, hàng hủy báo riêng, không trừ vào lợi nhuận gộp.
 */
export function ReturnsReportTab({ range, enabled }: ReportTabProps) {
  const [reason, setReason] = useState<ReturnReason | undefined>()
  const report = useReturnsReport({ ...range, reason }, enabled)
  const data = report.data
  if (report.error && !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!data) return <TabLoading />
  const writeOffValue = data.writeOffs.reduce((s, w) => s + w.value, 0)
  const title = `${displayDateKey(data.from)} - ${displayDateKey(data.to)}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Lọc theo lý do trả"
          allLabel="Mọi lý do"
          value={reason}
          onChange={setReason}
          options={(Object.keys(returnReasonLabels) as ReturnReason[]).map((r) => ({ value: r, label: returnReasonLabels[r] }))}
          className="sm:w-52"
        />
        <div className="ml-auto">
          <ExportButton
            fileName={reportFileName('doi-tra', data.from, data.to)}
            build={() => [
              excelSheet('Tiền hoàn theo lý do', `Tiền hoàn theo lý do ${title}`, [
                { header: 'Lý do', value: (r: (typeof data.byReason)[number]) => returnReasonLabels[r.reason], width: 22 },
                { header: 'Số phiếu', value: (r) => r.count, width: 10 },
                { header: 'Tiền hoàn', value: (r) => r.refundTotal, width: 16 },
              ], data.byReason),
              excelSheet('Hàng lỗi', `Sổ hàng lỗi ${title}`, [
                { header: 'Mã hàng', value: (r: (typeof data.defective.rows)[number]) => r.code, width: 10 },
                { header: 'Tên hàng', value: (r) => r.name, width: 36 },
                { header: 'Đơn vị cơ bản', value: (r) => r.baseUnit, width: 12 },
                { header: 'Số lượng', value: (r) => r.quantity, width: 10 },
                { header: 'Giá trị', value: (r) => r.value, width: 15 },
              ], data.defective.rows),
              excelSheet('Hàng hủy', `Hàng hủy qua phiếu điều chỉnh ${title}`, [
                { header: 'Lý do', value: (r: (typeof data.writeOffs)[number]) => adjustmentReasonLabels[r.reason], width: 14 },
                { header: 'Số lượng', value: (r) => r.quantity, width: 10 },
                { header: 'Giá trị', value: (r) => r.value, width: 15 },
              ], data.writeOffs),
            ]}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Phiếu đổi trả" value={formatNumber(data.returnCount, 0)} />
        <Stat label="Tiền hoàn" value={formatVnd(data.refundTotal)} />
        <Stat label="Hàng lỗi" value={formatVnd(data.defective.value)} sub={`${formatNumber(data.defective.quantity, 0)} đơn vị cơ bản`} />
        <Stat label="Hàng hủy" value={formatVnd(writeOffValue)} sub="Hỏng, hết hạn, mất qua phiếu điều chỉnh" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-base">Tiền hoàn theo lý do</CardTitle>
          </CardHeader>
          <CardContent>
            <SmallTable
              head={['Lý do', 'Số phiếu', 'Tiền hoàn']}
              empty="Không có phiếu đổi trả"
              rows={data.byReason.map((r) => [returnReasonLabels[r.reason], formatNumber(r.count, 0), formatVnd(r.refundTotal)])}
            />
          </CardContent>
        </Card>
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-base">Hàng hủy qua phiếu điều chỉnh</CardTitle>
            <CardDescription>Dòng điều chỉnh giảm với lý do Hỏng, Hết hạn, Mất.</CardDescription>
          </CardHeader>
          <CardContent>
            <SmallTable
              head={['Lý do', 'Số lượng', 'Giá trị']}
              empty="Không có hàng hủy"
              rows={data.writeOffs.map((w) => [adjustmentReasonLabels[w.reason], formatNumber(w.quantity, 0), formatVnd(w.value)])}
            />
          </CardContent>
        </Card>
      </div>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-base">Sổ hàng lỗi</CardTitle>
          <CardDescription>Hàng khách trả tình trạng Hàng lỗi, không cộng lại tồn; giá trị = số lượng × giá vốn dòng gốc.</CardDescription>
        </CardHeader>
        <CardContent>
          <SmallTable
            head={['Mặt hàng', 'Số lượng', 'Giá trị']}
            empty="Không có hàng lỗi"
            rows={data.defective.rows.map((r) => [
              <span key="n">
                {r.name} <span className="text-muted-foreground font-mono text-xs">{r.code}</span>
              </span>,
              `${formatNumber(r.quantity, 0)} ${r.baseUnit.toLowerCase()}`,
              formatVnd(r.value),
            ])}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function SmallTable({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="text-muted-foreground py-6 text-center text-sm">{empty}</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {head.map((h, i) => (
            <TableHead key={h} className={i > 0 ? 'text-right' : undefined}>
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            {r.map((c, j) => (
              <TableCell key={j} className={j > 0 ? 'text-right tabular-nums' : undefined}>
                {c}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
