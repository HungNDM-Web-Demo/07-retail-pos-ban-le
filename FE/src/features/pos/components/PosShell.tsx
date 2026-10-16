'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  Eye,
  LogOut,
  Menu,
  ReceiptText,
  ScanBarcode,
  Undo2,
  Volume2,
  VolumeX,
  Wallet,
} from 'lucide-react'
import { BrandMark } from '@/components/shared/BrandLogo'
import { UserMenu } from '@/components/shared/UserMenu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { appConfig } from '@/config/app.config'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { resolveHomePath } from '@/config/routes'
import { usePermissions } from '@/hooks/use-permissions'
import { cn } from '@/lib/utils'
import type { ShiftDto } from '@/types/retail-pos'
import { isPrintPreview, setPrintPreview } from '../lib/print'
import { isSoundOn, setSoundOn } from '../lib/sound'
import { useStoreProfile } from '../hooks/use-pos'
import { PrintPreviewHost } from './PrintPreviewHost'

type PosShellProps = {
  shift: ShiftDto | null | undefined
  /** Tab hóa đơn chờ, nút trong thanh trên (chỉ màn /pos) */
  center?: React.ReactNode
  onSampleBarcodes?: () => void
  children: React.ReactNode
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = setInterval(tick, 15_000)
    return () => clearInterval(id)
  }, [])
  return (
    <time className="text-muted-foreground hidden text-sm font-medium tabular-nums lg:block" suppressHydrationWarning>
      {now ? now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
    </time>
  )
}

/**
 * Khung màn quầy toàn màn hình (07 §4.3): logo, tên cửa hàng, thu ngân, mã ca, đồng hồ, tab hóa đơn chờ,
 * "Mã vạch mẫu", loa, menu (Hóa đơn, Đổi trả, Ca của tôi, Xem trước bản in, Thoát về trang chủ).
 */
export function PosShell({ shift, center, onSampleBarcodes, children }: PosShellProps) {
  const { can } = usePermissions()
  const store = useStoreProfile()
  const [sound, setSound] = useState(true)
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    // Đọc cài đặt trình duyệt sau khi gắn (tránh lệch SSR)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ một lần từ localStorage
    setSound(isSoundOn())
    setPreview(isPrintPreview())
  }, [])
  const home = resolveHomePath(can)
  const exitHref = home === routePath.pos ? routePath.orders : home

  return (
    <div className="bg-background flex h-svh flex-col overflow-hidden">
      <header className="bg-card flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <BrandMark size="sm" />
        <div className="hidden min-w-0 flex-col leading-tight xl:flex">
          <span className="truncate text-sm font-semibold">{store.data?.name ?? appConfig.name}</span>
          <span className="text-muted-foreground truncate text-xs">{shift?.cashierName ?? ''}</span>
        </div>
        <span className="bg-border mx-1 h-6 w-px" aria-hidden="true" />
        {shift ? (
          <span className="flex items-center gap-1.5 text-sm whitespace-nowrap" title={`Ca ${shift.code}`}>
            <span className="bg-success size-2 rounded-full" aria-hidden="true" />
            <span className="font-semibold tabular-nums">{shift.code}</span>
          </span>
        ) : (
          <span className="text-warning flex items-center gap-1.5 text-sm font-medium whitespace-nowrap">
            <span className="bg-warning size-2 rounded-full" aria-hidden="true" />
            Chưa mở ca
          </span>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2">{center}</div>
        <Clock />
        {onSampleBarcodes && (
          <Button variant="outline" className="h-10" onClick={onSampleBarcodes} disabled={!shift}>
            <ScanBarcode aria-hidden="true" />
            <span className="hidden lg:inline">Mã vạch mẫu</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={sound ? 'Tắt âm báo' : 'Bật âm báo'}
          aria-pressed={sound}
          onClick={() => {
            setSoundOn(!sound)
            setSound(!sound)
          }}
        >
          {sound ? <Volume2 /> : <VolumeX />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu màn bán hàng">
              <Menu />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {can(permissions.orders.create) && (
              <DropdownMenuItem asChild>
                <Link href={routePath.pos}>
                  <ScanBarcode /> Bán hàng
                </Link>
              </DropdownMenuItem>
            )}
            {can(permissions.orders.view) && (
              <DropdownMenuItem asChild>
                <Link href={routePath.orders}>
                  <ReceiptText /> Hóa đơn
                </Link>
              </DropdownMenuItem>
            )}
            {can(permissions.returns.view) && (
              <DropdownMenuItem asChild>
                <Link href={routePath.returns}>
                  <Undo2 /> Đổi trả
                </Link>
              </DropdownMenuItem>
            )}
            {can(permissions.shifts.operate) && (
              <DropdownMenuItem asChild>
                <Link href={routePath.shiftsCurrent}>
                  <Wallet /> Ca của tôi
                </Link>
              </DropdownMenuItem>
            )}
            {can(permissions.shifts.view) && (
              <DropdownMenuItem asChild>
                <Link href={routePath.shifts}>
                  <ClipboardList /> Ca làm
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={preview}
              onCheckedChange={(v) => {
                setPrintPreview(!!v)
                setPreview(!!v)
              }}
            >
              <Eye /> Xem trước bản in (không in)
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={exitHref}>
                <LogOut /> Thoát về trang chủ
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <UserMenu />
      </header>
      {/* Chừa chỗ nút công cụ demo nổi góc dưới phải để không che nút Thanh toán */}
      <main className={cn('min-h-0 flex-1 p-3', appConfig.demoToolbar && 'pb-3')}>{children}</main>
      <PrintPreviewHost />
    </div>
  )
}
