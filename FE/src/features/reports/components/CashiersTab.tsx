'use client'

import { Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DifferenceText } from '@/features/shift-review/components/DifferenceText'
import { formatNumber, formatVnd } from '@/lib/format'
import type { CashierReportRow } from '@/types/retail-pos'
import { useCashierReport } from '../hooks/use-reports'
import { displayDateKey } from '../lib/date-range'
import { excelSheet, reportFileName, type ExcelColumn } from '../lib/export-excel'
import { ExportButton, TabLoading, type ReportTabProps } from './ReportParts'

const COLUMNS: ExcelColumn<CashierReportRow>[] = [
  { header: 'Thu ngân', value: (r) => r.cashierName, width: 24 },
  { header: 'Số ca', value: (r) => r.shiftCount, width: 8 },
  { header: 'Số hóa đơn', value: (r) => r.orderCount, width: 11 },
  { header: 'Doanh thu thuần', value: (r) => r.netRevenue, width: 17 },
  { header: 'Phiếu đổi trả', value: (r) => r.returnCount, width: 13 },
  { header: 'Tổng chênh lệch ca', value: (r) => r.totalDifference, width: 18 },
]

/** Tab Thu ngân (FR-36): số ca, hóa đơn, doanh thu thuần, phiếu đổi trả, tổng chênh lệch các ca đã chốt */
export function CashiersTab({ range, enabled }: ReportTabProps) {
  const report = useCashierReport(range, enabled)
  const rows = report.data
  if (report.error && !rows) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!rows) return <TabLoading cards={0} />

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ExportButton
          fileName={reportFileName('thu-ngan', range.from, range.to)}
          disabled={!rows.length}
          build={() => [excelSheet('Theo thu ngân', `Theo thu ngân ${displayDateKey(range.from)} - ${displayDateKey(range.to)}`, COLUMNS, rows)]}
        />
      </div>
      <Card className="gap-0 py-0">
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="Không có ca trong khoảng này" />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Thu ngân</TableHead>
                  <TableHead className="text-right">Số ca</TableHead>
                  <TableHead className="text-right">Số hóa đơn</TableHead>
                  <TableHead className="text-right">Doanh thu thuần</TableHead>
                  <TableHead className="text-right">Phiếu đổi trả</TableHead>
                  <TableHead className="text-right">Tổng chênh lệch ca</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.cashierId}>
                    <TableCell className="font-medium">{r.cashierName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.shiftCount, 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.orderCount, 0)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatVnd(r.netRevenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.returnCount, 0)}</TableCell>
                    <TableCell className="text-right">
                      <DifferenceText value={r.totalDifference} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
