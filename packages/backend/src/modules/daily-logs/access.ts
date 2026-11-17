import { canProjectPermission } from "../../lib/authorization.ts";
import { requestAccessContext, type AuthorizationRequest, type AuthorizedProject } from "../../lib/authorization-request.ts";

export function dailyLogEntryVoidActor(request: AuthorizationRequest, project: AuthorizedProject, user: { id: string; name: string }) {
  return { id: user.id, name: user.name, canManage: canProjectPermission(
    { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id }, requestAccessContext(request), "dailyLog", "void",
  ) };
}
