'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock, Printer, ScanBarcode, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { routePath, routeTo } from '@/config/route-path'
import { shiftStatusLabels, shiftStatusVariants } from '@/config/retail-pos-labels'
import { useStoreProfile } from '@/features/pos/hooks/use-pos'
import { PrintPreviewHost } from '@/features/pos/components/PrintPreviewHost'
import { printUrl } from '@/features/pos/lib/print'
import { clearEmptyHeldTabs, readHeldTabs } from '@/features/pos/stores/held-tabs.store'
import { usePermissions } from '@/hooks/use-permissions'
import type { ShiftDto } from '@/types/retail-pos'
import { CloseShiftDialog } from '../components/CloseShiftDialog'
import { OpenShiftForm } from '../components/OpenShiftForm'
import { ShiftSummary } from '../components/ShiftSummary'
import { useCurrentShift } from '../hooks/use-shifts'

/** Ca của tôi `/shifts/current` (SCR-06; UC-02, UC-09): mở ca, tổng hợp ca đang mở, chốt ca, in báo cáo ca */
export function CurrentShiftPage() {
  const { user, can } = usePermissions()
  const shiftQuery = useCurrentShift()
  const store = useStoreProfile()
  const [closing, setClosing] = useState(false)
  const [closed, setClosed] = useState<ShiftDto | null>(null)
  const shift = shiftQuery.data
  const heldWithLines = user && closing ? readHeldTabs(user.id).tabs.filter((t) => t.lines.length > 0) : []

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Ca của tôi"
        icon={Wallet}
        description="Mở ca, xem tổng hợp ca đang mở, đếm tiền chốt ca"
        actions={
          shift &&
          can(permissions.orders.create) && (
            <Button asChild variant="outline">
              <Link href={routePath.pos}>
                <ScanBarcode aria-hidden="true" /> Về màn bán hàng
              </Link>
            </Button>
          )
        }
      />
      {shiftQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : shiftQuery.error ? (
        <ErrorState error={shiftQuery.error} onRetry={() => void shiftQuery.refetch()} />
      ) : shift ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                Ca {shift.code}
                <StatusBadge tone={shiftStatusVariants[shift.status]}>{shiftStatusLabels[shift.status]}</StatusBadge>
              </CardTitle>
              <CardDescription>{shift.cashierName} · số liệu tính tới lúc mở trang</CardDescription>
            </div>
            <Button variant="cta" size="lg" onClick={() => setClosing(true)}>
              <Lock aria-hidden="true" /> Chốt ca
            </Button>
          </CardHeader>
          <CardContent>
            <ShiftSummary shift={shift} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Mở ca</CardTitle>
              <CardDescription>Bạn chưa có ca đang mở. Đếm tiền lẻ trong két rồi nhập tiền đầu ca.</CardDescription>
            </CardHeader>
            <CardContent>
              {store.data ? (
                <OpenShiftForm defaultOpeningCash={store.data.defaultOpeningCash} autoFocus={false} />
              ) : (
                <Skeleton className="h-24" />
              )}
            </CardContent>
          </Card>
          {closed && (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Đã chốt ca {closed.code}
                    <StatusBadge tone={shiftStatusVariants[closed.status]}>{shiftStatusLabels[closed.status]}</StatusBadge>
                  </CardTitle>
                </div>
                <Button variant="outline" onClick={() => printUrl(`${routeTo.shiftReceipt(closed.id)}?reprint=1`)}>
                  <Printer aria-hidden="true" /> In lại báo cáo ca
                </Button>
              </CardHeader>
              <CardContent>
                <ShiftSummary shift={closed} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
      {shift && (
        <CloseShiftDialog
          open={closing}
          onOpenChange={setClosing}
          shift={shift}
          heldWithLines={heldWithLines}
          onClosed={(result) => {
            setClosing(false)
            setClosed(result)
            if (user) clearEmptyHeldTabs(user.id)
            toast.success(`Đã chốt ca ${result.code}`, {
              description: result.status === 'CanKiemTra' ? 'Chênh lệch quá 20.000 ₫, ca chờ chủ cửa hàng kiểm tra' : undefined,
            })
            printUrl(routeTo.shiftReceipt(result.id))
          }}
        />
      )}
      <PrintPreviewHost />
    </div>
  )
}
