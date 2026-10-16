import { routePath } from '@/config/route-path'

/**
 * Tham số trang in tem `/products/labels` (07 §4.6): `ids` mặt hàng, `copies` số tem đơn vị cơ bản mỗi mặt hàng;
 * thêm `units=unitId:n,…` khi chọn số tem từng đơn vị (có `units` thì bỏ qua `copies`).
 */
export function labelsHref(ids: string[], units?: [string, number][], copies = 1): string {
  const params = new URLSearchParams({ ids: ids.join(',') })
  if (units?.length) params.set('units', units.map(([id, n]) => `${id}:${n}`).join(','))
  else params.set('copies', String(copies))
  return `${routePath.productLabels}?${params.toString()}`
}

export type LabelRequest = { ids: string[]; copies: number; units: Map<string, number> | null }

export function parseLabelParams(search: URLSearchParams): LabelRequest {
  const ids = (search.get('ids') ?? '').split(',').filter(Boolean)
  const copies = Math.min(99, Math.max(1, Number(search.get('copies')) || 1))
  const raw = search.get('units')
  const units = raw
    ? new Map(
        raw
          .split(',')
          .map((pair) => pair.split(':'))
          .filter(([id, n]) => id && Number(n) > 0)
          .map(([id, n]) => [id, Math.min(99, Number(n))] as [string, number])
      )
    : null
  return { ids, copies, units }
}
