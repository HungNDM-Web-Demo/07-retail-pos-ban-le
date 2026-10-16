'use client'

import Link from 'next/link'
import { Printer, ShieldCheck, Undo2 } from 'lucide-react'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { routePath, routeTo } from '@/config/route-path'
import {
  orderReturnStatusLabels,
  orderReturnStatusVariants,
  paymentMethodLabels,
} from '@/config/retail-pos-labels'
import { printUrl } from '@/features/pos/lib/print'
import { usePermissions } from '@/hooks/use-permissions'
import { formatDateTime, formatNumber, formatPhone, formatVnd } from '@/lib/format'
import { useOrder } from '../hooks/use-orders'

type OrderDetailSheetProps = { orderId: string | null; onOpenChange: (open: boolean) => void }

/** Chi tiết hóa đơn (SCR-08): dòng, giảm giá, khoản thu, phiếu đổi trả liên quan; in lại, đổi trả */
export function OrderDetailSheet({ orderId, onOpenChange }: OrderDetailSheetProps) {
  const { can } = usePermissions()
  const { data: o, isLoading, error, refetch } = useOrder(orderId)
  return (
    <Sheet open={!!orderId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            Hóa đơn {o?.code}
            {o && <StatusBadge tone={orderReturnStatusVariants[o.returnStatus]}>{orderReturnStatusLabels[o.returnStatus]}</StatusBadge>}
          </SheetTitle>
          <SheetDescription>
            {o ? `${formatDateTime(o.paidAt)} · ${o.cashierName} · ca ${o.shiftCode}` : 'Đang tải…'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <Skeleton className="h-60" />
          ) : error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : o ? (
            <div className="grid gap-4 text-sm">
              <table className="w-full">
                <thead className="text-muted-foreground text-xs uppercase">
                  <tr className="border-b">
                    <th className="py-1.5 text-left">Hàng</th>
                    <th className="py-1.5 text-right">SL</th>
                    <th className="py-1.5 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {o.lines.map((l) => (
                    <tr key={l.id} className="border-b align-top">
                      <td className="py-2">
                        <p className="font-medium">{l.productName}</p>
                        <p className="text-muted-foreground text-xs">
                          {l.unitName} × {formatNumber(l.unitPrice, 0)}
                          {l.discount ? ` · giảm ${formatNumber(l.discount.amount, 0)}` : ''}
                          {l.returnedQty ? ` · đã trả ${l.returnedQty}` : ''}
                          {!l.returnable ? ' · không đổi trả' : ''}
                        </p>
                      </td>
                      <td className="py-2 text-right tabular-nums">{l.quantity}</td>
                      <td className="py-2 text-right tabular-nums">{formatVnd(l.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="grid gap-1">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tổng tiền hàng</dt>
                  <dd className="tabular-nums">{formatVnd(o.subtotal)}</dd>
                </div>
                {o.discountTotal > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Giảm giá</dt>
                    <dd className="text-destructive tabular-nums">−{formatVnd(o.discountTotal)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold">
                  <dt>Tổng thanh toán</dt>
                  <dd className="tabular-nums">{formatVnd(o.total)}</dd>
                </div>
                {o.payments.map((p, i) => (
                  <div key={i} className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {paymentMethodLabels[p.method]}
                      {p.cashReceived ? ` (khách đưa ${formatNumber(p.cashReceived, 0)}, thối ${formatNumber(p.changeAmount ?? 0, 0)})` : ''}
                    </dt>
                    <dd className="tabular-nums">{formatVnd(p.amount)}</dd>
                  </div>
                ))}
                {o.costTotal !== undefined && o.costTotal !== null && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Giá vốn</dt>
                    <dd className="tabular-nums">{formatVnd(o.costTotal)}</dd>
                  </div>
                )}
              </dl>
              {o.approvedByName && (
                <p className="text-success flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="size-4" aria-hidden="true" /> Giảm giá do {o.approvedByName} xác nhận
                </p>
              )}
              {o.customer && (
                <p>
                  Khách: <strong>{o.customer.name}</strong> · {formatPhone(o.customer.phone)} · +{o.pointsEarned} điểm
                </p>
              )}
              {o.note && <p className="text-muted-foreground">Ghi chú: {o.note}</p>}
              {o.exchangeForReturn && <p>Hóa đơn đổi hàng của phiếu {o.exchangeForReturn.code}</p>}
              {o.returns.length > 0 && (
                <div>
                  <p className="mb-1 font-medium">Phiếu đổi trả</p>
                  <ul className="grid gap-1">
                    {o.returns.map((r) => (
                      <li key={r.id} className="flex justify-between">
                        <span>
                          {r.code} · {formatDateTime(r.createdAt)}
                        </span>
                        <span className="tabular-nums">hoàn {formatVnd(r.refundTotal)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>
        {o && (
          <SheetFooter className="flex-row justify-end gap-2 border-t">
            {can(permissions.returns.create) && o.returnStatus !== 'TraHet' && (
              <Button asChild variant="outline">
                <Link href={`${routePath.returnNew}?code=${o.code}`}>
                  <Undo2 aria-hidden="true" /> Đổi trả
                </Link>
              </Button>
            )}
            {can(permissions.orders.reprint) && (
              <Button onClick={() => printUrl(`${routeTo.orderReceipt(o.id)}?reprint=1`)}>
                <Printer aria-hidden="true" /> In lại
              </Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
