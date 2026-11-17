import type { Knex } from "knex";
import { createHash } from "node:crypto";
import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { fieldToolContext } from "../field-actions/tool-context.ts";
import { documentsRepository } from "../documents/repository.ts";
import { stagesRepository } from "../stages/repository.ts";
import { updatesRepository } from "../updates/repository.ts";
import type { ToolContext } from "../panda-ai/agent/tool-context.ts";
import { messagingAgentAccess } from "./access.ts";
import type { MessagingScope } from "./types.ts";
import { messagingReadResourceEnabled } from "./tool-discovery-policy.ts";
import { computeAccess } from "../participants/access.ts";
import type { MessagingAccess } from "./management-types.ts";

export async function messagingDiscoveryContext(db: Knex, userId: string, scope: MessagingScope) {
  const access = await messagingAgentAccess(db).project(userId, scope.projectId);
  if (access.project.organization_id !== scope.organizationId) throw new ForbiddenError("The selected project belongs to another workspace.");
  if (scope.buildingId) await messagingAgentAccess(db).building(access, scope.buildingId);
  const field = await fieldToolContext(db, { kind: "read", ...scope, payload: {}, idempotencyKey: "read" }, { userId, organizationId: scope.organizationId });
  const context: ToolContext = { db, projectId: scope.projectId, caller: {
    user: field.user, project: { id: field.project.id, ownerId: field.project.owner_id, organizationId: field.project.organization_id },
    orgRoles: field.request.orgRoles, projectRoles: field.request.projectRoles ?? new Map(), orgPermissions: field.request.orgPermissions,
    projectSectionPermissions: field.request.projectSectionPermissions ?? new Map(), projectGrants: field.request.projectGrants ?? new Map(),
  }, readableResource: (resource) => messagingReadResourceEnabled(access.features, resource) };
  return { access, field, context };
}

/** Bind actual read privileges, including company-only record visibility, for one planning turn. */
export function authorizationBinding(current: Awaited<ReturnType<typeof messagingDiscoveryContext>>, previous?: MessagingAccess): string {
  const project = previous?.project ?? current.field.project, user = previous?.user ?? current.field.user;
  const computed = computeAccess(project, { ...current.field.request, ...previous?.context, user, requireAuth: () => ({ id: user.id }) });
  const ordered = (grants: Record<string, string[]>) => Object.entries(grants).filter(([, actions]) => actions.length)
    .sort(([left], [right]) => left.localeCompare(right)).map(([resource, actions]) => [resource, [...actions].sort()]);
  return createHash("sha256").update(JSON.stringify({ projectId: project.id, organizationId: project.organization_id,
    userId: user.id, permissions: ordered(computed.permissions), workspacePermissions: ordered(computed.workspacePermissions),
    features: Object.entries((previous ?? current.access).features.enabled ?? {}).sort(([left], [right]) => left.localeCompare(right)),
    internalRfis: computed.capabilities.canViewInternalRfis, fullTasks: computed.capabilities.canSeeFullTaskBoard, fullExpenses: computed.capabilities.canSeeAllExpenses,
  })).digest("hex");
}

/** Read arguments carry real authorized record IDs, never a free route into another project. */
export async function requireMessagingReadTargets(db: Knex, projectId: string, args: Record<string, unknown>) {
  if (typeof args.documentId === "string" && (await documentsRepository(db).findDocumentById(args.documentId))?.project_id !== projectId) throw new NotFoundError("Document");
  if (typeof args.stageId === "string" && (await stagesRepository(db).findById(args.stageId))?.project_id !== projectId) throw new NotFoundError("Stage");
  if (typeof args.updateId === "string") {
    const update = await updatesRepository(db).findById(args.updateId);
    if (!update || update.project_id !== projectId) throw new NotFoundError("Update");
    if (update.is_draft) throw new ForbiddenError("Draft updates cannot be read through this conversation.");
  }
}
