import { ForbiddenError } from "./errors.ts";

// viewer is excluded: read-only stakeholders must not mutate project data.
const WRITE_ROLES: ReadonlySet<string> = new Set(["owner", "admin", "member"]);

export interface ProjectScope {
  id?: string;
  ownerId: string | null;
  organizationId: string | null;
}

export interface AccessContext {
  userId: string;
  orgRoles: ReadonlyMap<string, string>;
  // Participant roles keyed by project id (e.g. "client"). Populated per-request
  // from project_participants for external stakeholders (homeowners, etc.).
  projectRoles?: ReadonlyMap<string, string>;
}

function isMemberOf(orgId: string | null, ctx: AccessContext): boolean {
  return orgId !== null && ctx.orgRoles.has(orgId);
}

/** The caller's participant role on this project, if any (e.g. "client"). */
export function participantRole(project: ProjectScope, ctx: AccessContext): string | undefined {
  return project.id ? ctx.projectRoles?.get(project.id) : undefined;
}

function isParticipant(project: ProjectScope, ctx: AccessContext): boolean {
  return participantRole(project, ctx) !== undefined;
}

// A NULL owner is never a grant on its own; only genuine seed rows (no owner AND
// no org) are world-readable, so an org row whose owner was deleted stays gated.
export function assertCanAccessProject(project: ProjectScope, ctx: AccessContext): void {
  if (project.ownerId === ctx.userId) return;
  if (isMemberOf(project.organizationId, ctx)) return;
  if (isParticipant(project, ctx)) return; // homeowner / external stakeholder
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

function canModify(project: ProjectScope, ctx: AccessContext): boolean {
  try {
    assertCanModifyProject(project, ctx);
    return true;
  } catch {
    return false;
  }
}

/**
 * Actions that belong to the homeowner: deciding approvals, raising queries,
 * commenting. Allowed for company staff with write access OR an active "client"
 * participant. Company viewers and unrelated users are rejected.
 */
export function assertCanActAsClient(project: ProjectScope, ctx: AccessContext): void {
  if (canModify(project, ctx)) return;
  if (participantRole(project, ctx) === "client") return;
  throw new ForbiddenError("You do not have permission to perform this action");
}
