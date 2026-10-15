import { requestAccessContext, type AuthorizationRequest, type AuthorizedProject } from "../../lib/authorization-request.ts";
import type { ProjectRow } from "../projects/types.ts";
import { assertProjectPermission, canSeeAllTasks } from "../../lib/authorization.ts";

export function canSeeFullTaskBoard(request: AuthorizationRequest, project: Pick<ProjectRow, "id" | "owner_id" | "organization_id">): boolean {
  return canSeeAllTasks(
    { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
    requestAccessContext(request),
  );
}

export function assertTaskBoardAccess(request: AuthorizationRequest, project: AuthorizedProject): void {
  assertProjectPermission({ id: project.id, ownerId: project.owner_id, organizationId: project.organization_id }, requestAccessContext(request), "tasks", "view");
}
