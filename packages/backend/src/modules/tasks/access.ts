import type { FastifyRequest } from "fastify";
import type { ProjectRow } from "../projects/types.ts";
import { canSeeAllTasks } from "../../lib/authorization.ts";
import { ForbiddenError } from "../../lib/errors.ts";

export function canSeeFullTaskBoard(request: FastifyRequest, project: Pick<ProjectRow, "id" | "owner_id" | "organization_id">): boolean {
  const user = request.requireAuth();
  const orgId = project.organization_id;
  return canSeeAllTasks(
    { id: project.id, ownerId: project.owner_id, organizationId: orgId },
    {
      userId: user.id,
      orgRoles: request.orgRoles,
      projectRoles: request.projectRoles,
      projectSectionPermissions: request.projectSectionPermissions,
      projectGrants: request.projectGrants,
      orgPermissions: request.orgPermissions,
    },
  );
}

export function assertCompanyTaskAccess(request: FastifyRequest, project: ProjectRow): void {
  const user = request.requireAuth();
  if (project.owner_id === user.id) return;
  if (project.organization_id && request.orgRoles.has(project.organization_id)) return;
  throw new ForbiddenError("Only company team members can access the task board");
}
