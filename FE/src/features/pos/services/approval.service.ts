import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { ApprovalDto, ApprovalRequest } from '@/types/retail-pos'
import { approvalsMock } from '../mock/approvals.mock'

/** POST /api/approvals (07 §2.5) */
export const approvalService = {
  create: (input: ApprovalRequest): Promise<ApprovalDto> =>
    isMockMode() ? approvalsMock.create(input) : apiCall.post<ApprovalDto>(apiRoutes.approvals.create, input),
}
