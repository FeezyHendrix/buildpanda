import type { AuthorizationRequest } from "../../lib/authorization-request.ts";

export function isCompanyCaller(
    request: Pick<AuthorizationRequest, "requireAuth" | "orgRoles">,
    project: { owner_id: string | null; organization_id: string | null },
  ): boolean {
    const user = request.requireAuth();
    if (project.owner_id === user.id) return true;
    return Boolean(project.organization_id && request.orgRoles.has(project.organization_id));
  }


