'use client'

import Link from 'next/link'
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CalendarClock, ChevronRight, CircleDollarSign, LayoutDashboard, ReceiptText, ShoppingBasket, TrendingUp } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { KpiCard } from '@/features/dashboard/components/KpiCard'
import { formatSignedVnd } from '@/features/products/lib/product-format'
import { formatNumber, formatTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { compactVnd, pctChange } from '../components/ReportParts'
import { useDashboard } from '../hooks/use-reports'
import { displayDateKey, shortDateKey } from '../lib/date-range'

const config = {
  netRevenue: { label: 'Doanh thu thuần', color: 'var(--chart-1)' },
  grossProfit: { label: 'Lợi nhuận gộp', color: 'var(--chart-2)' },
} satisfies ChartConfig

/**
 * SCR-01 Tổng quan (UC-11, FR-01, FR-02): 4 thẻ số hôm nay so cùng giờ hôm qua, biểu đồ 7 ngày, top 10 bán chạy hôm
 * nay, thẻ cảnh báo hàng sắp hết và lô hạn sử dụng bấm mở Tồn kho đã lọc. Gắn `reports.view` (quyết định 2).
 */
export function DashboardPage() {
  const q = useDashboard()
  const d = q.data
  const label = d ? `so với cùng giờ hôm qua (${formatTime(d.asOf)})` : 'so với cùng giờ hôm qua'
  const change = (cur: number, prev: number) => pctChange(cur, prev) ?? undefined

  return (
    <PermissionGuard permission={permissions.reports.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Tổng quan"
          icon={LayoutDashboard}
          description={d ? `Số liệu hôm nay tính tới ${formatTime(d.asOf)}, tự làm mới mỗi phút.` : 'Doanh thu, lãi gộp hôm nay và cảnh báo kho.'}
        />
        {q.error && !d ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Doanh thu thuần hôm nay"
                icon={CircleDollarSign}
                isLoading={!d}
                value={d ? formatVnd(d.today.netRevenue) : ''}
                change={d ? change(d.today.netRevenue, d.sameTimeYesterday.netRevenue) : undefined}
                changeLabel={label}
              />
              <KpiCard
                label="Lợi nhuận gộp"
                icon={TrendingUp}
                isLoading={!d}
                value={d ? formatSignedVnd(d.today.grossProfit) : ''}
                change={d ? change(d.today.grossProfit, d.sameTimeYesterday.grossProfit) : undefined}
                changeLabel={label}
              />
              <KpiCard
                label="Số hóa đơn"
                icon={ReceiptText}
                isLoading={!d}
                value={d ? formatNumber(d.today.orderCount, 0) : ''}
                change={d ? change(d.today.orderCount, d.sameTimeYesterday.orderCount) : undefined}
                changeLabel={label}
              />
              <KpiCard
                label="Trung bình mỗi hóa đơn"
                icon={ShoppingBasket}
                isLoading={!d}
                value={d ? formatVnd(d.today.avgOrderValue) : ''}
                change={d ? change(d.today.avgOrderValue, d.sameTimeYesterday.avgOrderValue) : undefined}
                changeLabel={label}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <AlertCard
                href={`${routePath.stock}?status=SapHet`}
                icon={AlertTriangle}
                tone="warning"
                loading={!d}
                value={d?.lowStockCount ?? 0}
                title="mặt hàng sắp hết, hết hoặc âm kho"
                hint="Mở Tồn kho để đặt hàng bổ sung"
              />
              <AlertCard
                href={`${routePath.stock}?tab=lots`}
                icon={CalendarClock}
                tone="destructive"
                loading={!d}
                value={(d?.expiringLotCount ?? 0) + (d?.expiredLotCount ?? 0)}
                title={d ? `lô cần xử lý: ${d.expiringLotCount} sắp hết hạn, ${d.expiredLotCount} đã hết hạn` : 'lô cần xử lý'}
                hint="Bán đẩy lô sắp hết hạn, hủy lô đã hết hạn"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">7 ngày gần nhất</CardTitle>
                  <CardDescription>Cột doanh thu thuần, đường lợi nhuận gộp (hôm nay tính tới hiện tại).</CardDescription>
                </CardHeader>
                <CardContent>
                  {!d ? (
                    <Skeleton className="h-72" />
                  ) : (
                    <ChartContainer config={config} className="aspect-auto h-72 w-full" aria-label="Biểu đồ doanh thu thuần và lợi nhuận gộp 7 ngày">
                      <ComposedChart data={d.last7Days} margin={{ left: 4, right: 8, top: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="date" tickFormatter={shortDateKey} tickLine={false} axisLine={false} />
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
                        <Bar dataKey="netRevenue" fill="var(--color-netRevenue)" radius={[4, 4, 0, 0]} maxBarSize={44} />
                        <Line dataKey="grossProfit" type="monotone" stroke="var(--color-grossProfit)" strokeWidth={2.5} />
                      </ComposedChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
              <Card className="gap-3">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Top 10 bán chạy hôm nay</CardTitle>
                    <CardDescription>Theo số lượng đơn vị cơ bản bán thuần.</CardDescription>
                  </div>
                  <Link href={`${routePath.reports}?tab=products`} className="text-primary text-sm underline-offset-4 hover:underline">
                    Báo cáo
                  </Link>
                </CardHeader>
                <CardContent>
                  {!d ? (
                    <div className="space-y-2">
                      {Array.from({ length: 6 }, (_, i) => (
                        <Skeleton key={i} className="h-8" />
                      ))}
                    </div>
                  ) : d.topProducts.length === 0 ? (
                    <EmptyState icon={ShoppingBasket} title="Hôm nay chưa bán hàng" compact />
                  ) : (
                    <ol className="space-y-1.5">
                      {d.topProducts.map((p, i) => (
                        <li key={p.productId} className="flex items-center gap-3 text-sm">
                          <span
                            className={cn(
                              'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                              i < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{p.name}</span>
                          <span className="text-muted-foreground shrink-0 tabular-nums">
                            {formatNumber(p.quantity, 0)} {p.baseUnit.toLowerCase()}
                          </span>
                          <span className="w-24 shrink-0 text-right font-medium tabular-nums">{formatVnd(p.netRevenue)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </PermissionGuard>
  )
}

function AlertCard({
  href,
  icon: Icon,
  tone,
  value,
  title,
  hint,
  loading,
}: {
  href: string
  icon: typeof AlertTriangle
  tone: 'warning' | 'destructive'
  value: number
  title: string
  hint: string
  loading: boolean
}) {
  return (
    <Link
      href={href}
      className="bg-card hover:bg-muted/40 focus-visible:ring-ring/50 group flex items-center gap-4 rounded-xl border p-5 shadow-xs transition-colors outline-none focus-visible:ring-3"
    >
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl',
          tone === 'warning' ? 'bg-warning/15 text-warning' : 'bg-destructive/10 text-destructive'
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <span className={cn('block text-2xl font-semibold tabular-nums', tone === 'warning' ? 'text-warning' : 'text-destructive')}>{value}</span>
        )}
        <span className="block text-sm font-medium">{title}</span>
        <span className="text-muted-foreground block text-xs">{hint}</span>
      </span>
      <ChevronRight className="text-muted-foreground size-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}
