import type { MessagingAccess, MessagingReadAccess } from "./management-types.ts";
import type { Knex } from "knex";
import { createHash } from "node:crypto";
import { isCompanyCaller } from "../rfis/access.ts";
import { messagingReadResourceEnabled } from "./tool-discovery-policy.ts";
import { messagingReadScopeRepository } from "./read-scope-repository.ts";
import type { MessagingScope } from "./types.ts";

/** A combined answer is withheld if any grant used to generate it was revoked. */
export function mayReadAnswer(access: MessagingAccess, snapshot: MessagingReadAccess, recordScope?: string): boolean {
  const contains = (current: Record<string, string[]>, previous: Record<string, string[]>) =>
    Object.entries(previous).every(([resource, actions]) => actions.every((action) => current[resource]?.includes(action)));
  return (!snapshot.recordScope || snapshot.recordScope === recordScope) && access.capabilities.read && contains(access.permissions, snapshot.permissions) &&
    contains(access.workspacePermissions ?? {}, snapshot.workspacePermissions) &&
    Object.entries(snapshot.features).every(([key, enabled]) => !enabled || access.features.enabled?.[key] === true);
}

export async function messagingReadFingerprint(db: Knex, access: MessagingAccess, scope: MessagingScope): Promise<string> {
  const has = (resource: string, action = "view") => messagingReadResourceEnabled(access.features, resource) && access.permissions[resource]?.includes(action) === true;
  const records = await messagingReadScopeRepository(db).visibleRecords({ projectId: scope.projectId, organizationId: scope.organizationId, userId: access.user.id,
    fullTasks: has("tasks", "viewAll"), internalRfis: isCompanyCaller({ ...access.context, requireAuth: () => ({ id: access.user.id }) }, access.project),
    projectMessages: has("messages"), workspaceMessages: access.workspacePermissions?.messages?.includes("view") === true,
    tasks: has("tasks"), expenses: has("finances", "viewCosts"), fullExpenses: has("finances", "viewAllExpenses"), rfis: has("rfis"), updates: has("updates"), documents: has("documents"),
  });
  return createHash("sha256").update(JSON.stringify(records)).digest("hex");
}
