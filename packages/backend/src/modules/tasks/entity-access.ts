import { NotFoundError } from "../../lib/errors.ts";
import { canProjectPermission } from "../../lib/authorization.ts";
import { requestAccessContext, type AuthorizationRequest, type AuthorizedProject } from "../../lib/authorization-request.ts";
import { isCompanyCaller } from "../rfis/access.ts";
import type { TaskDetail, TaskEntityType } from "./types.ts";
import type { TaskEntityAccessRepository } from "./entity-access-repository.ts";

export const TASK_ENTITY_READ_REQUIREMENTS = {
  rfi: ["rfis", "view"], change_request: ["change-requests", "view"], material: ["materials", "view"],
  invoice: ["finances", "viewCosts"], milestone_payment: ["finances", "view"],
} as const;

export async function filterTaskEntityAccess(request: AuthorizationRequest, project: AuthorizedProject, detail: TaskDetail, repository: TaskEntityAccessRepository): Promise<TaskDetail> {
  const scope = { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id };
  const access = requestAccessContext(request);
  const allowed = new Set((Object.entries(TASK_ENTITY_READ_REQUIREMENTS) as [TaskEntityType, readonly [string, string]][])
    .filter(([, [resource, action]]) => canProjectPermission(scope, access, resource, action)).map(([type]) => type));
  const eligible = detail.entityLinks.filter((link) => allowed.has(link.entityType));
  const visible = await repository.visible(project.id, eligible, !isCompanyCaller(request, project));
  const entityLinks = eligible.filter((link) => visible.has(`${link.entityType}:${link.entityId}`));
  return { ...detail, entityLinks, entityLinkTypes: [...new Set(entityLinks.map((link) => link.entityType))] };
}

export async function requireTaskEntityTargetRead(request: AuthorizationRequest, project: AuthorizedProject, entityType: TaskEntityType, entityId: string, repository: TaskEntityAccessRepository): Promise<void> {
  const [resource, action] = TASK_ENTITY_READ_REQUIREMENTS[entityType];
  await request.requireProjectPermission(project.id, resource, action);
  const visible = await repository.visible(project.id, [{ entityType, entityId }], !isCompanyCaller(request, project));
  if (!visible.has(`${entityType}:${entityId}`)) throw new NotFoundError("Linked record");
}
