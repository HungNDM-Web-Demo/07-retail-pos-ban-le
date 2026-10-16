import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import { applyFieldErrors, getErrorMessage, getFieldErrors, isApiError } from '@/lib/api-error'
import type { PosErrorCode } from '@/types/retail-pos'

/** Mã nghiệp vụ của lỗi ProblemDetails (07 §2.12), cả hai chế độ dữ liệu */
export function problemCode(error: unknown): PosErrorCode | undefined {
  return isApiError(error) ? (error.problem as { code?: PosErrorCode }).code : undefined
}

/** Trường mở rộng của lỗi, vd `serverTotal`, `approvalReasons`, `overStock` */
export function problemExtra<T>(error: unknown, key: string): T | undefined {
  return isApiError(error) ? ((error.problem as Record<string, unknown>)[key] as T | undefined) : undefined
}

/**
 * Gắn lỗi theo trường của BE/mock vào form; trường form không hiển thị (vd `lines.0.unitId`, `imageUrl`)
 * thì hiện toast để lỗi không bị nuốt. Không có lỗi theo trường thì toast thông báo chung.
 */
export function applyFormErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: unknown,
  isShown: (key: string) => boolean
) {
  const fields = Object.entries(getFieldErrors(error))
  const shown = fields.filter(([key]) => isShown(key)).map(([key]) => key as Path<T>)
  const hidden = fields.find(([key]) => !isShown(key))
  if (shown.length) applyFieldErrors(setError, error, shown)
  if (!shown.length || hidden) toast.error(hidden?.[1] ?? getErrorMessage(error))
}
