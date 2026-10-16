'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CloseShiftRequest, OpenShiftRequest, ReviewShiftRequest, ShiftQuery } from '@/types/retail-pos'
import { shiftService } from '../services/shift.service'

/** Query key 07 §4.7 */
export const shiftKeys = {
  current: ['shift-current'] as const,
  list: (query: ShiftQuery) => ['shifts', query] as const,
  detail: (id: string) => ['shift', id] as const,
}

/** Ca đang mở của người dùng; null khi chưa mở */
export function useCurrentShift(enabled = true) {
  return useQuery({ queryKey: shiftKeys.current, queryFn: shiftService.current, enabled })
}

export function useShifts(query: ShiftQuery) {
  return useQuery({ queryKey: shiftKeys.list(query), queryFn: () => shiftService.list(query), placeholderData: keepPreviousData })
}

export function useShiftDetail(id: string | null | undefined) {
  return useQuery({ queryKey: shiftKeys.detail(id ?? ''), queryFn: () => shiftService.detail(id!), enabled: !!id })
}

function useInvalidateShifts() {
  const qc = useQueryClient()
  return () => {
    for (const key of ['shift-current', 'shifts', 'shift', 'reports', 'pos-catalog']) {
      void qc.invalidateQueries({ queryKey: [key] })
    }
  }
}

export function useOpenShift() {
  const invalidate = useInvalidateShifts()
  return useMutation({ mutationFn: (input: OpenShiftRequest) => shiftService.open(input), onSuccess: invalidate })
}

export function useCloseShift() {
  const invalidate = useInvalidateShifts()
  return useMutation({ mutationFn: (input: CloseShiftRequest) => shiftService.close(input), onSuccess: invalidate })
}

export function useReviewShift() {
  const invalidate = useInvalidateShifts()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviewShiftRequest }) => shiftService.review(id, input),
    onSuccess: invalidate,
  })
}
