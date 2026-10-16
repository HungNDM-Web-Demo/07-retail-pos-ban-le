'use client'

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatPct, formatSignedVnd } from '@/features/products/lib/product-format'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { GroupProfitRow } from '@/types/retail-pos'
import { useGroupReport } from '../hooks/use-reports'
import { displayDateKey } from '../lib/date-range'
import { excelSheet, reportFileName, type ExcelColumn } from '../lib/export-excel'
import { ExportButton, TabLoading, compactVnd, type ReportTabProps } from './ReportParts'

const config = { grossProfit: { label: 'Lợi nhuận gộp', color: 'var(--chart-1)' } } satisfies ChartConfig

type Row = Pick<GroupProfitRow, 'groupName' | 'netRevenue' | 'cogs' | 'grossProfit' | 'marginPct' | 'profitShare'>
const COLUMNS: ExcelColumn<Row>[] = [
  { header: 'Nhóm hàng', value: (r) => r.groupName, width: 30 },
  { header: 'Doanh thu thuần', value: (r) => r.netRevenue, width: 17 },
  { header: 'Giá vốn', value: (r) => r.cogs, width: 16 },
  { header: 'Lợi nhuận gộp', value: (r) => r.grossProfit, width: 16 },
  { header: 'Biên lãi gộp (%)', value: (r) => r.marginPct, width: 15, format: '0.0' },
  { header: 'Tỉ trọng lợi nhuận (%)', value: (r) => r.profitShare, width: 20, format: '0.0' },
]

/** Tab Lợi nhuận theo nhóm (FR-37, TC-45): tổng các nhóm bằng tổng tab Doanh thu */
export function GroupsTab({ range, enabled }: ReportTabProps) {
  const report = useGroupReport(range, enabled)
  const data = report.data
  if (report.error && !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!data) return <TabLoading cards={0} />
  const t = data.totals

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Lợi nhuận gộp theo nhóm hàng</CardTitle>
            <CardDescription>
              Tổng {formatSignedVnd(t.grossProfit)} trên doanh thu thuần {formatVnd(t.netRevenue)}, biên {formatPct(t.marginPct)}. Biên lãi mỗi
              nhóm = lợi nhuận gộp ÷ doanh thu thuần của nhóm.
            </CardDescription>
          </div>
          <ExportButton
            fileName={reportFileName('nhom-hang', data.from, data.to)}
            disabled={!data.rows.length}
            build={() => [
              excelSheet<Row>('Theo nhóm hàng', `Lợi nhuận theo nhóm ${displayDateKey(data.from)} - ${displayDateKey(data.to)}`, COLUMNS, [
                ...data.rows,
                { groupName: 'Tổng', ...t, profitShare: 100 },
              ]),
            ]}
          />
        </CardHeader>
        <CardContent>
          <ChartContainer config={config} className="aspect-auto h-80 w-full" aria-label="Biểu đồ lợi nhuận gộp theo nhóm hàng">
            <BarChart data={data.rows} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickFormatter={compactVnd} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="groupName" width={190} tickLine={false} axisLine={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <div className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">Lợi nhuận gộp</span>
                        <span className="font-medium tabular-nums">{formatSignedVnd(Number(value))}</span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="grossProfit" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {data.rows.map((r) => (
                  <Cell key={r.groupId} fill={r.color} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card className="gap-0 py-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Nhóm hàng</TableHead>
                <TableHead className="text-right">Doanh thu thuần</TableHead>
                <TableHead className="text-right">Giá vốn</TableHead>
                <TableHead className="text-right">Lợi nhuận gộp</TableHead>
                <TableHead className="text-right">Biên lãi gộp</TableHead>
                <TableHead className="w-48">Tỉ trọng lợi nhuận</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.groupId}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: r.color }} aria-hidden="true" />
                      {r.groupName}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(r.netRevenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(r.cogs)}</TableCell>
                  <TableCell className={cn('text-right font-medium tabular-nums', r.grossProfit < 0 && 'text-destructive')}>
                    {formatSignedVnd(r.grossProfit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatPct(r.marginPct)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                        <div className="bg-primary h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, r.profitShare))}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs tabular-nums">{formatPct(r.profitShare)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot className="bg-muted border-t font-semibold">
              <TableRow>
                <TableCell>Tổng</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(t.netRevenue)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(t.cogs)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatSignedVnd(t.grossProfit)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPct(t.marginPct)}</TableCell>
                <TableCell />
              </TableRow>
            </tfoot>
          </Table>
        </div>
      </Card>
    </div>
  )
}
