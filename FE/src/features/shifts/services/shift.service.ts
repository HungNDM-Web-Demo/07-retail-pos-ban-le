import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  CloseShiftRequest,
  OpenShiftRequest,
  ReviewShiftRequest,
  ShiftDetail,
  ShiftDto,
  ShiftQuery,
} from '@/types/retail-pos'
import { shiftMock } from '../mock/shift.mock'

/** Mọi API `/api/shifts` (07 §2.7). FE-Quản lý dùng list/detail/review cho màn `/shifts`. */
export const shiftService = {
  /** Ca đang mở của người gọi; null khi chưa mở ca (BE trả 204) */
  current: async (): Promise<ShiftDto | null> => {
    if (isMockMode()) return shiftMock.current()
    const data = await apiCall.get<ShiftDto | ''>(apiRoutes.shifts.current)
    return data ? data : null
  },

  open: (input: OpenShiftRequest): Promise<ShiftDto> =>
    isMockMode() ? shiftMock.open(input) : apiCall.post<ShiftDto>(apiRoutes.shifts.list, input),

  close: (input: CloseShiftRequest): Promise<ShiftDto> =>
    isMockMode() ? shiftMock.close(input) : apiCall.post<ShiftDto>(apiRoutes.shifts.close, input),

  list: (query: ShiftQuery): Promise<PaginatedResult<ShiftDto>> =>
    isMockMode()
      ? shiftMock.list(query)
      : apiCall.get<PaginatedResult<ShiftDto>>(apiRoutes.shifts.list, { params: query }),

  detail: (id: string): Promise<ShiftDetail> =>
    isMockMode() ? shiftMock.detail(id) : apiCall.get<ShiftDetail>(apiRoutes.shifts.detail(id)),

  review: (id: string, input: ReviewShiftRequest): Promise<ShiftDto> =>
    isMockMode() ? shiftMock.review(id, input) : apiCall.patch<ShiftDto>(apiRoutes.shifts.review(id), input),
}
