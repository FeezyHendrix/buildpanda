import { ForbiddenError } from "./errors.ts";

// viewer is excluded: read-only stakeholders must not mutate project data.
const WRITE_ROLES: ReadonlySet<string> = new Set(["owner", "admin", "member"]);

export interface ProjectScope {
  ownerId: string | null;
  organizationId: string | null;
}

export interface AccessContext {
  userId: string;
  orgRoles: ReadonlyMap<string, string>;
}

function isMemberOf(orgId: string | null, ctx: AccessContext): boolean {
  return orgId !== null && ctx.orgRoles.has(orgId);
}

// A NULL owner is never a grant on its own; only genuine seed rows (no owner AND
// no org) are world-readable, so an org row whose owner was deleted stays gated.
export function assertCanAccessProject(project: ProjectScope, ctx: AccessContext): void {
  if (project.ownerId === ctx.userId) return;
  if (isMemberOf(project.organizationId, ctx)) return;
  if (project.ownerId === null && project.organizationId === null) return;
  throw new ForbiddenError("You do not have access to this resource");
}

// Seed/orphan rows are never writable through the org path.
export function assertCanModifyProject(project: ProjectScope, ctx: AccessContext): void {
  if (project.ownerId === ctx.userId) return;
  if (project.organizationId !== null) {
    const role = ctx.orgRoles.get(project.organizationId);
    if (role !== undefined && WRITE_ROLES.has(role)) return;
  }
  throw new ForbiddenError("You do not have access to modify this resource");
}
