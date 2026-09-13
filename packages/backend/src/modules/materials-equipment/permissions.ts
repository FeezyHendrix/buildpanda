import type { FastifyRequest } from "fastify";
import { canProjectPermission } from "../../lib/authorization.ts";
import { ForbiddenError } from "../../lib/errors.ts";

// Approval-tier statuses: moving an order/request into (or past) approval
// needs materials:approve; raising/cancelling only needs materials:request.
// materials:manage implies both, so legacy custom roles keep working.
export const MATERIAL_APPROVAL_STATUSES: ReadonlySet<string> = new Set([
  "Approved",
  "Ordered",
  "PartiallyDelivered",
  "Delivered",
  "Rejected",
]);

export const EQUIPMENT_APPROVAL_STATUSES: ReadonlySet<string> = new Set([
  "Approved",
  "Scheduled",
  "OnHire",
  "Returned",
  "Rejected",
]);

export interface MaterialsProjectScope {
  id: string;
  owner_id: string | null;
  organization_id: string | null;
}

export function assertMaterialsAction(
  request: FastifyRequest,
  project: MaterialsProjectScope,
  action: "request" | "approve",
): void {
  const user = request.requireAuth();
  const scope = { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id };
  const ctx = {
    userId: user.id,
    orgRoles: request.orgRoles,
    projectRoles: request.projectRoles,
    orgPermissions: request.orgPermissions,
    projectSectionPermissions: request.projectSectionPermissions,
  };
  if (canProjectPermission(scope, ctx, "materials", action)) return;
  if (canProjectPermission(scope, ctx, "materials", "manage")) return;
  throw new ForbiddenError(
    action === "approve"
      ? "Your role does not allow you to approve material or equipment requests"
      : "Your role does not allow you to raise material or equipment requests",
  );
}
