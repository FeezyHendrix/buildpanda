import { canProjectPermission } from "../../lib/authorization.ts";
import { requestAccessContext, type AuthorizationRequest } from "../../lib/authorization-request.ts";
import { ForbiddenError } from "../../lib/errors.ts";
import type { MaterialApprovalGuardReader, UpdateMaterialApprovalInput } from "./material-types.ts";
import { DECISION_STATUSES } from "./types.ts";

/** A named reviewer retains their decision; approval permission cannot sign on their behalf. */
export async function authorizeMaterialApprovalUpdate(request: AuthorizationRequest, service: MaterialApprovalGuardReader, projectId: string, approvalId: string, input: UpdateMaterialApprovalInput) {
  const deciding = input.status !== undefined && DECISION_STATUSES.includes(input.status);
  const project = await request.requireProjectPermission(projectId, "materials", deciding ? "approve" : "request");
  const userId = request.requireAuth().id;
  if (input.requestedReviewerId !== undefined && !canProjectPermission(
    { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id }, requestAccessContext(request), "materials", "approve",
  )) throw new ForbiddenError("Only a material approver can reassign the requested reviewer");
  if (deciding) {
    const approval = await service.get(projectId, approvalId);
    if (approval.requestedReviewerId && approval.requestedReviewerId !== userId) {
      throw new ForbiddenError("This material approval is awaiting a decision from its requested reviewer");
    }
  }
  return project;
}

export async function authorizeMaterialApprovalDelete(request: AuthorizationRequest, service: MaterialApprovalGuardReader, projectId: string, approvalId: string) {
  const project = await request.requireProjectPermission(projectId, "materials", "approve");
  if ((await service.get(projectId, approvalId)).status !== "Pending") throw new ForbiddenError("Only pending material approvals can be deleted");
  return project;
}
