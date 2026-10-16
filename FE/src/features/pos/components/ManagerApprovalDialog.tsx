'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { FormField } from '@/components/shared/FormField'
import { PasswordInput } from '@/components/shared/PasswordInput'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/lib/api-error'
import type { ApprovalAction, ApprovalDto } from '@/types/retail-pos'
import { approvalService } from '../services/approval.service'

type ManagerApprovalDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: ApprovalAction
  /** Từng lý do cần xác nhận (vd "Giảm 7,3%, vượt hạn mức 5%") */
  reasons: string[]
  onApproved: (approval: ApprovalDto) => void
}

/**
 * Hộp "Chủ cửa hàng xác nhận" (FR-16, FR-25, 07 §4.3): chủ cửa hàng gõ tài khoản ngay trên máy bán hàng
 * → POST /api/approvals. Sai mật khẩu, thiếu quyền → lỗi hiện dưới ô, hóa đơn giữ nguyên (TC-24).
 */
export function ManagerApprovalDialog({ open, onOpenChange, action, reasons, onApproved }: ManagerApprovalDialogProps) {
  const approve = useMutation({ mutationFn: approvalService.create })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setUsername('')
      setPassword('')
      setError(null)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setError(null)
    if (!username.trim() || !password) return setError('Nhập tên đăng nhập và mật khẩu của chủ cửa hàng')
    approve.mutate(
      { username: username.trim(), password, action },
      {
        onSuccess: (result) => {
          // Báo kết quả trước khi đóng: nơi gọi coi "đóng mà chưa duyệt" là hủy
          onApproved(result)
          onOpenChange(false)
        },
        onError: (err) => {
          setError(getErrorMessage(err))
          setPassword('')
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !approve.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="sm:flex-row sm:items-start sm:gap-4">
          <span
            className="bg-warning/12 text-warning flex size-11 shrink-0 items-center justify-center rounded-full"
            aria-hidden="true"
          >
            <ShieldCheck className="size-5" />
          </span>
          <div className="space-y-1.5 text-left">
            <DialogTitle>Chủ cửa hàng xác nhận {action === 'GiamGia' ? 'giảm giá' : 'đổi trả'}</DialogTitle>
            <DialogDescription asChild>
              <ul className="list-disc space-y-0.5 pl-4">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {error && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/8 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <FormField label="Tên đăng nhập" htmlFor="approval-username" required>
            <Input
              id="approval-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="vd: quanly"
              className="h-11"
              autoFocus
            />
          </FormField>
          <FormField label="Mật khẩu" htmlFor="approval-password" required>
            <PasswordInput
              id="approval-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              className="h-11"
            />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onOpenChange(false)}
              disabled={approve.isPending}
            >
              Hủy
            </Button>
            <Button type="submit" className="h-11" disabled={approve.isPending}>
              {approve.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Xác nhận
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
