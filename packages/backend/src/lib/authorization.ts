import { ForbiddenError } from "./errors.ts";
import { isEmployeeRole, mapAllows, type PermissionMap } from "./permissions.ts";

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

export interface EnrichedAccessContext extends AccessContext {
  orgPermissions: ReadonlyMap<string, PermissionMap>;
}

// Org membership grants access to every project in the org — except for
// employee-role members, who are scoped to their assigned projects only.
function hasOrgWideProjectAccess(orgId: string | null, ctx: AccessContext): boolean {
  if (orgId === null) return false;
  const role = ctx.orgRoles.get(orgId);
  return role !== undefined && !isEmployeeRole(role);
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
  if (hasOrgWideProjectAccess(project.organizationId, ctx)) return;
  if (isParticipant(project, ctx)) return; // homeowner / external stakeholder / employee
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

// Deletion is more privileged than modification: a plain "member" may edit but
// not delete. Only the project owner or an org owner/admin may delete.
const DELETE_ROLES: ReadonlySet<string> = new Set(["owner", "admin"]);

export function assertCanDeleteProject(project: ProjectScope, ctx: AccessContext): void {
  if (project.ownerId === ctx.userId) return;
  if (project.organizationId !== null) {
    const role = ctx.orgRoles.get(project.organizationId);
    if (role !== undefined && DELETE_ROLES.has(role)) return;
  }
  throw new ForbiddenError("You do not have permission to delete this project");
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

// ---------------------------------------------------------------------------
// Phase 2: unified resource-action permission check
// ---------------------------------------------------------------------------

/** Additive capabilities granted to project participants (external stakeholders). */
export const PARTICIPANT_PERMISSIONS: Record<string, Record<string, readonly string[]>> = {
  client: {
    project: ["view"],
    tasks: ["view"],
    finances: ["view", "dispute"],
    approvals: ["view", "decide"],
    selections: ["view", "decide"],
    queries: ["view", "raise"],
    "change-requests": ["view"],
    "action-items": ["view"],
    stages: ["view"],
    "key-dates": ["view"],
    comments: ["view", "post"],
    updates: ["view"],
    documents: ["view"],
    inspections: ["view"],
    materials: ["view", "report"],
    contractors: ["view"],
    dailyLog: ["view", "report"],
    messages: ["view", "send"],
    participants: ["view"],
    teamMembers: ["view"],
    schedule: ["view"],
    rfis: ["view", "create"],
    bim: ["view"],
  },
  architect: {
    project: ["view"],
    tasks: ["view"],
    finances: ["view"],
    approvals: ["view"],
    selections: ["view"],
    queries: ["view", "raise"],
    "change-requests": ["view"],
    "action-items": ["view"],
    stages: ["view"],
    "key-dates": ["view"],
    comments: ["view", "post"],
    updates: ["view"],
    documents: ["view"],
    inspections: ["view"],
    materials: ["view", "report"],
    contractors: ["view"],
    dailyLog: ["view", "report"],
    messages: ["view", "send"],
    participants: ["view"],
    teamMembers: ["view"],
    schedule: ["view"],
    rfis: ["view", "create", "respond"],
    bim: ["view"],
  },
  inspector: {
    project: ["view"],
    tasks: ["view"],
    finances: ["view"],
    approvals: ["view"],
    selections: ["view"],
    queries: ["view"],
    "action-items": ["view"],
    stages: ["view"],
    "key-dates": ["view"],
    comments: ["view", "post"],
    updates: ["view"],
    documents: ["view"],
    inspections: ["view", "request"],
    materials: ["view", "report"],
    contractors: ["view"],
    dailyLog: ["view", "report"],
    participants: ["view"],
    schedule: ["view"],
    rfis: ["view"],
    bim: ["view"],
  },
  guest: {
    project: ["view"],
    tasks: ["view"],
    finances: ["view"],
    approvals: ["view"],
    selections: ["view"],
    updates: ["view"],
    documents: ["view"],
    inspections: ["view"],
    materials: ["view", "report"],
    contractors: ["view"],
    dailyLog: ["view", "report"],
    participants: ["view"],
    schedule: ["view"],
    stages: ["view"],
    "key-dates": ["view"],
  },
};

/**
 * Unified resource-action guard that composes org role + participant overlay.
 * Replaces the per-resource assertCanModifyProject pattern for operations that
 * need granular control (finances:approve, participants:manage, etc.).
 */
export function assertProjectPermission(
  project: ProjectScope & { id: string },
  ctx: EnrichedAccessContext,
  resource: string,
  action: string,
): void {
  // Personal project owners have full access
  if (project.ownerId === ctx.userId) return;

  // Tenant gate: must have org or participant access
  assertCanAccessProject(project, ctx);

  // Org-role permissions (bound to this project's org)
  const orgId = project.organizationId;
  const orgPerms = orgId ? ctx.orgPermissions.get(orgId) : undefined;
  const orgAllowed = orgPerms ? mapAllows(orgPerms, resource, action) : false;

  // Participant-role overlay (additive)
  const pRole = participantRole(project, ctx);
  const pPerms = pRole ? PARTICIPANT_PERMISSIONS[pRole] : undefined;
  const participantAllowed = pPerms ? (pPerms[resource] ?? []).includes(action) : false;

  if (!orgAllowed && !participantAllowed) {
    throw new ForbiddenError(`Your role does not allow you to ${action} ${resource}`);
  }
}

export function canProjectPermission(
  project: ProjectScope & { id: string },
  ctx: EnrichedAccessContext,
  resource: string,
  action: string,
): boolean {
  if (project.ownerId === ctx.userId) return true;

  const orgId = project.organizationId;
  const orgPerms = orgId ? ctx.orgPermissions.get(orgId) : undefined;
  if (orgPerms && mapAllows(orgPerms, resource, action)) return true;

  const pRole = participantRole(project, ctx);
  const pPerms = pRole ? PARTICIPANT_PERMISSIONS[pRole] : undefined;
  return pPerms ? (pPerms[resource] ?? []).includes(action) : false;
}
