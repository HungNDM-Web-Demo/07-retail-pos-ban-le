'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { shiftService } from '@/features/shifts/services/shift.service'
import type { ShiftQuery } from '@/types/retail-pos'

/** Màn `/shifts` (SCR-07) gọi service ca của FE-Bán hàng (07 §4.9); query key 07 §4.7 */
export function useShiftList(query: ShiftQuery) {
  return useQuery({ queryKey: ['shifts', query], queryFn: () => shiftService.list(query), placeholderData: keepPreviousData })
}

export function useShiftDetail(id: string | null) {
  return useQuery({ queryKey: ['shift', id], queryFn: () => shiftService.detail(id!), enabled: !!id })
}

export function useReviewShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => shiftService.review(id, { note }),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: ['shifts'] })
      void qc.invalidateQueries({ queryKey: ['shift', v.id] })
      void qc.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}
