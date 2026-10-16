'use client'

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { ChartColumn } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatPct, formatSignedVnd } from '@/features/products/lib/product-format'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { RevenueTotals } from '@/types/retail-pos'
import { useRevenueReport } from '../hooks/use-reports'
import { displayDateKey, shortDateKey } from '../lib/date-range'
import { excelSheet, reportFileName, type ExcelColumn } from '../lib/export-excel'
import { ChangeText, ExportButton, Stat, TabLoading, TabToolbar, compactVnd, pctChange, type ReportTabProps } from './ReportParts'

const config = {
  netRevenue: { label: 'Doanh thu thuần', color: 'var(--chart-1)' },
  grossProfit: { label: 'Lợi nhuận gộp', color: 'var(--chart-2)' },
  previousNet: { label: 'Doanh thu thuần kỳ trước', color: 'var(--muted-foreground)' },
} satisfies ChartConfig

type Row = RevenueTotals & { date: string; previousNet?: number }

const COLUMNS: ExcelColumn<Row>[] = [
  { header: 'Ngày', value: (d) => (d.date ? displayDateKey(d.date) : 'Tổng'), width: 12 },
  { header: 'Doanh thu bán', value: (d) => d.salesTotal, width: 16 },
  { header: 'Tiền hoàn', value: (d) => d.refundTotal, width: 14 },
  { header: 'Doanh thu thuần', value: (d) => d.netRevenue, width: 17 },
  { header: 'Giá vốn hàng bán thuần', value: (d) => d.cogs, width: 22 },
  { header: 'Lợi nhuận gộp', value: (d) => d.grossProfit, width: 16 },
  { header: 'Biên lãi gộp (%)', value: (d) => d.marginPct, width: 15, format: '0.0' },
  { header: 'Số hóa đơn', value: (d) => d.orderCount, width: 11 },
  { header: 'Số phiếu đổi trả', value: (d) => d.returnCount, width: 15 },
  { header: 'Doanh thu thuần kỳ trước', value: (d) => d.previousNet, width: 22 },
]

/** Tab Doanh thu (FR-36, BR-30, UC-15): theo ngày, so kỳ trước cùng độ dài (đường nền), xuất Excel */
export function RevenueTab({ range, enabled }: ReportTabProps) {
  const report = useRevenueReport(range, enabled)
  const data = report.data
  if (report.error && !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!data) return <TabLoading cards={8} />

  const t = data.totals
  const p = data.previous.totals
  const rows: Row[] = data.days.map((d, i) => ({ ...d, previousNet: data.previous.days[i]?.netRevenue }))
  const hasData = t.orderCount > 0 || t.returnCount > 0 || p.orderCount > 0

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Doanh thu thuần" value={formatVnd(t.netRevenue)} sub={<ChangeText value={pctChange(t.netRevenue, p.netRevenue)} />} />
        <Stat
          label="Lợi nhuận gộp"
          value={formatSignedVnd(t.grossProfit)}
          tone={t.grossProfit < 0 ? 'destructive' : undefined}
          sub={<ChangeText value={pctChange(t.grossProfit, p.grossProfit)} />}
        />
        <Stat label="Biên lãi gộp" value={formatPct(t.marginPct)} sub={`Kỳ trước ${formatPct(p.marginPct)}`} />
        <Stat label="Số hóa đơn" value={formatNumber(t.orderCount, 0)} sub={`Kỳ trước ${formatNumber(p.orderCount, 0)}`} />
        <Stat label="Doanh thu bán" value={formatVnd(t.salesTotal)} sub="Tổng thanh toán của hóa đơn" />
        <Stat label="Tiền hoàn" value={formatVnd(t.refundTotal)} sub={`${formatNumber(t.returnCount, 0)} phiếu đổi trả`} />
        <Stat label="Giá vốn hàng bán thuần" value={formatVnd(t.cogs)} sub="Giá vốn dòng bán − giá vốn hàng trả" />
        <Stat
          label="Kỳ trước"
          value={formatVnd(p.netRevenue)}
          sub={`${displayDateKey(data.previous.from)} → ${displayDateKey(data.previous.to)}`}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Doanh thu thuần, lợi nhuận gộp theo ngày</CardTitle>
            <CardDescription>Đường đứt nét là doanh thu thuần kỳ trước cùng độ dài, xếp theo thứ tự ngày.</CardDescription>
          </div>
          <TabToolbar>
            <ExportButton
              fileName={reportFileName('doanh-thu', data.from, data.to)}
              disabled={!rows.length}
              build={() => [
                excelSheet('Doanh thu theo ngày', `Doanh thu, lợi nhuận ${displayDateKey(data.from)} - ${displayDateKey(data.to)}`, COLUMNS, [
                  ...rows,
                  { ...t, date: '', previousNet: p.netRevenue },
                ]),
              ]}
            />
          </TabToolbar>
        </CardHeader>
        <CardContent>
          {!hasData ? (
            <EmptyState icon={ChartColumn} title="Chưa có doanh thu" description="Khoảng ngày này và kỳ trước chưa có hóa đơn." />
          ) : (
            <ChartContainer config={config} className="aspect-auto h-80 w-full" aria-label="Biểu đồ doanh thu thuần và lợi nhuận gộp theo ngày">
              <ComposedChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDateKey} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis tickFormatter={compactVnd} tickLine={false} axisLine={false} width={52} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => displayDateKey(String(payload?.[0]?.payload?.date ?? ''))}
                      formatter={(value, name) => (
                        <div className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">{config[name as keyof typeof config]?.label}</span>
                          <span className="font-medium tabular-nums">{formatVnd(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="netRevenue" fill="var(--color-netRevenue)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Line dataKey="grossProfit" type="monotone" stroke="var(--color-grossProfit)" strokeWidth={2} dot={false} />
                <Line dataKey="previousNet" type="monotone" stroke="var(--color-previousNet)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {hasData && (
        <Card className="gap-0 py-0">
          <div className="max-h-[28rem] overflow-auto">
            <Table className="min-w-[960px]">
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead className="text-right">Doanh thu bán</TableHead>
                  <TableHead className="text-right">Tiền hoàn</TableHead>
                  <TableHead className="text-right">Doanh thu thuần</TableHead>
                  <TableHead className="text-right">Giá vốn thuần</TableHead>
                  <TableHead className="text-right">Lợi nhuận gộp</TableHead>
                  <TableHead className="text-right">Biên lãi</TableHead>
                  <TableHead className="text-right">HĐ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...rows].reverse().map((d) => (
                  <RevenueRow key={d.date} label={displayDateKey(d.date)} row={d} />
                ))}
              </TableBody>
              <tfoot className="bg-muted sticky bottom-0 border-t font-semibold">
                <RevenueRow label="Tổng" row={t} />
              </tfoot>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}

function RevenueRow({ label, row }: { label: string; row: RevenueTotals }) {
  return (
    <TableRow>
      <TableCell className="tabular-nums">{label}</TableCell>
      <TableCell className="text-right tabular-nums">{formatVnd(row.salesTotal)}</TableCell>
      <TableCell className={cn('text-right tabular-nums', row.refundTotal > 0 && 'text-destructive')}>{formatVnd(row.refundTotal)}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">{formatVnd(row.netRevenue)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatVnd(row.cogs)}</TableCell>
      <TableCell className={cn('text-right font-medium tabular-nums', row.grossProfit < 0 && 'text-destructive')}>{formatSignedVnd(row.grossProfit)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatPct(row.marginPct)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(row.orderCount, 0)}</TableCell>
    </TableRow>
  )
}
