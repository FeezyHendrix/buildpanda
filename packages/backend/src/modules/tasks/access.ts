import type { FastifyRequest } from "fastify";
import type { ProjectRow } from "../projects/types.ts";
import { canProjectPermission } from "../../lib/authorization.ts";
import { isEmployeeRole } from "../../lib/permissions.ts";
import { ForbiddenError } from "../../lib/errors.ts";

export function canSeeFullTaskBoard(request: FastifyRequest, project: ProjectRow): boolean {
  const user = request.requireAuth();
  if (project.owner_id === user.id) return true;

  // Company managers (any non-viewer org role on this project) manage the whole
  // board — this mirrors the isCompanyManager capability the client uses to
  // enable drag, so the UI and API agree. Employees are scoped to assigned
  // tasks; org viewers and external participants never get the full board.
  const orgId = project.organization_id;
  const orgRole = orgId ? request.orgRoles.get(orgId) : undefined;
  if (orgRole && orgRole !== "viewer" && !isEmployeeRole(orgRole)) return true;

  return canProjectPermission(
    { id: project.id, ownerId: project.owner_id, organizationId: orgId },
    {
      userId: user.id,
      orgRoles: request.orgRoles,
      projectRoles: request.projectRoles,
      projectSectionPermissions: request.projectSectionPermissions,
      orgPermissions: request.orgPermissions,
    },
    "tasks",
    "remove",
  );
}

export function assertCompanyTaskAccess(request: FastifyRequest, project: ProjectRow): void {
  const user = request.requireAuth();
  if (project.owner_id === user.id) return;
  if (project.organization_id && request.orgRoles.has(project.organization_id)) return;
  throw new ForbiddenError("Only company team members can access the task board");
}
