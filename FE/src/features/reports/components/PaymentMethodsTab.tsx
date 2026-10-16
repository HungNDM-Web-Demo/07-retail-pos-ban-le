'use client'

import { Cell, Pie, PieChart } from 'recharts'
import { Wallet } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { paymentMethodLabels } from '@/config/retail-pos-labels'
import { formatPct } from '@/features/products/lib/product-format'
import { formatNumber, formatVnd } from '@/lib/format'
import type { PaymentMethod, PaymentMethodReportRow } from '@/types/retail-pos'
import { usePaymentMethodReport } from '../hooks/use-reports'
import { displayDateKey } from '../lib/date-range'
import { excelSheet, reportFileName, type ExcelColumn } from '../lib/export-excel'
import { ExportButton, TabLoading, type ReportTabProps } from './ReportParts'

const COLORS: Record<PaymentMethod, string> = {
  TienMat: 'var(--chart-1)',
  ChuyenKhoan: 'var(--chart-2)',
  The: 'var(--chart-3)',
  BuTruDoiHang: 'var(--chart-4)',
}
const config = Object.fromEntries(
  (Object.keys(COLORS) as PaymentMethod[]).map((m) => [m, { label: paymentMethodLabels[m], color: COLORS[m] }])
) satisfies ChartConfig

const COLUMNS: ExcelColumn<PaymentMethodReportRow>[] = [
  { header: 'Phương thức', value: (r) => paymentMethodLabels[r.method], width: 18 },
  { header: 'Số tiền', value: (r) => r.amount, width: 17 },
  { header: 'Số hóa đơn', value: (r) => r.orderCount, width: 11 },
  { header: 'Tỉ trọng (%)', value: (r) => r.share, width: 12, format: '0.0' },
]

/** Tab Phương thức thanh toán (FR-36): số tiền, số hóa đơn, tỉ trọng; Bù trừ đổi hàng tách riêng (quyết định 12) */
export function PaymentMethodsTab({ range, enabled }: ReportTabProps) {
  const report = usePaymentMethodReport(range, enabled)
  const rows = report.data
  if (report.error && !rows) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!rows) return <TabLoading cards={0} />
  const total = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">Theo phương thức thanh toán · tổng {formatVnd(total)}</CardTitle>
        <ExportButton
          fileName={reportFileName('phuong-thuc', range.from, range.to)}
          disabled={!rows.length}
          build={() => [excelSheet('Phương thức', `Phương thức thanh toán ${displayDateKey(range.from)} - ${displayDateKey(range.to)}`, COLUMNS, rows)]}
        />
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState icon={Wallet} title="Không có hóa đơn trong khoảng này" />
        ) : (
          <div className="grid items-center gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <ChartContainer config={config} className="mx-auto aspect-square h-64" aria-label="Biểu đồ tỉ trọng phương thức thanh toán">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      nameKey="method"
                      formatter={(value, _name, item) => (
                        <div className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">{paymentMethodLabels[(item.payload as PaymentMethodReportRow).method]}</span>
                          <span className="font-medium tabular-nums">{formatVnd(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                <Pie data={rows} dataKey="amount" nameKey="method" innerRadius={56} strokeWidth={2}>
                  {rows.map((r) => (
                    <Cell key={r.method} fill={COLORS[r.method]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phương thức</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead className="text-right">Số hóa đơn</TableHead>
                  <TableHead className="text-right">Tỉ trọng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.method}>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2.5 rounded-sm" style={{ backgroundColor: COLORS[r.method] }} aria-hidden="true" />
                        {paymentMethodLabels[r.method]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatVnd(r.amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.orderCount, 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPct(r.share)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
