import { resolvePermissionMap } from "../../lib/permissions.ts";
import type { EnrichedAccessContext, ProjectSectionPermissions } from "../../lib/authorization.ts";
import type { AccessContextRows } from "../../plugins/access-cache.ts";

/** HTTP, AI and realtime consume the same authoritative participant overlay. */
export function resolveAccessContext(userId: string, rows: AccessContextRows): EnrichedAccessContext {
  const { memberRows, customRoleRows, participantRows } = rows;
  const byOrg = new Map<string, AccessContextRows["customRoleRows"]>();
  for (const role of customRoleRows) {
    const list = byOrg.get(role.organizationId) ?? [];
    list.push(role); byOrg.set(role.organizationId, list);
  }
  return {
    userId,
    orgRoles: new Map(memberRows.map((row) => [row.organizationId, row.role])),
    orgPermissions: new Map(memberRows.map((row) => [row.organizationId, resolvePermissionMap(row.role, byOrg.get(row.organizationId) ?? [])])),
    projectRoles: new Map(participantRows.map((row) => [row.project_id, row.role])),
    projectSectionPermissions: new Map(participantRows.filter((row) => row.permissions && Object.keys(row.permissions).length > 0)
      .map((row) => [row.project_id, row.permissions as ProjectSectionPermissions])),
    // {} is an explicit deny-all overlay. Only null means use legacy defaults.
    projectGrants: new Map(participantRows.filter((row) => row.grants != null)
      .map((row) => [row.project_id, row.grants!])),
  };
}
