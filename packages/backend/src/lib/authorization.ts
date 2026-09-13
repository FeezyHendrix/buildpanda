import { ForbiddenError } from "./errors.ts";
import { mapAllows, statement, type PermissionMap } from "./permissions.ts";
import { PARTICIPANT_PERMISSIONS, ROLE_PRESET_SIDES } from "./role-presets.ts";
import {
  composeParticipantPermissions,
  sectionsToPermissions,
  type ProjectSectionPermissions,
  type SectionValue,
} from "./section-permissions.ts";

// Re-exported so every existing importer keeps its one import site.
export { PARTICIPANT_PERMISSIONS, ROLE_PRESET_SIDES };
export { composeParticipantPermissions, sectionsToPermissions };
export type { ProjectSectionPermissions, SectionValue };


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
  // Per-participant page-access matrix keyed by project id. When present it is
  // the source of truth for that participant (overrides role defaults); absent
  // means fall back to the role default.
  projectSectionPermissions?: ReadonlyMap<string, ProjectSectionPermissions>;
  // Raw resource->actions[] grants keyed by project id — the new source of
  // truth. When a project has an entry here it is authoritative and the legacy
  // (role default ∪ section matrix) path is skipped entirely.
  projectGrants?: ReadonlyMap<string, Record<string, readonly string[]>>;
}

export interface EnrichedAccessContext extends AccessContext {
  orgPermissions: ReadonlyMap<string, PermissionMap>;
}

// Org membership grants read access to every project in the org. Mutating a
// project still goes through WRITE_ROLES / resource-action checks below.
function hasOrgWideProjectAccess(orgId: string | null, ctx: AccessContext): boolean {
  if (orgId === null) return false;
  return ctx.orgRoles.has(orgId);
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

/**
 * Reference data an organisation defines once and every project draws from —
 * inspection categories, and anything like them. Editing the list is an admin
 * act: a site agent picks from it, the company decides what is on it.
 */
export function assertCanManageOrgReference(project: ProjectScope, ctx: AccessContext): void {
  if (project.ownerId === ctx.userId) return;
  if (project.organizationId !== null) {
    const role = ctx.orgRoles.get(project.organizationId);
    if (role !== undefined && DELETE_ROLES.has(role)) return;
  }
  throw new ForbiddenError("Only a workspace admin can change this list");
}

/**
 * Which side of the contract a caller is acting from, derived from their
 * participant role — never from the self-declared accountType. A consultant
 * (architect, resident engineer, materials engineer) acts FOR the employer, so
 * they count as client-side; anybody with no participant role at all is
 * workspace staff, i.e. the party doing the building.
 *
 * Used to record who asked for an independent inspection.
 */
export function contractSideOf(participantRole: string | undefined): "client" | "contractor" {
  if (!participantRole) return "contractor";
  return ROLE_PRESET_SIDES[participantRole] === "contractor" ? "contractor" : "client";
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

export function effectiveParticipantGrants(
  project: ProjectScope & { id: string },
  ctx: AccessContext,
): Record<string, readonly string[]> {
  const stored = ctx.projectGrants?.get(project.id);
  if (stored) return stored;
  const pRole = participantRole(project, ctx);
  const roleDefaults = pRole ? PARTICIPANT_PERMISSIONS[pRole] : undefined;
  const sections = ctx.projectSectionPermissions?.get(project.id);
  return composeParticipantPermissions(roleDefaults, sections);
}

function participantAllows(
  project: ProjectScope & { id: string },
  ctx: AccessContext,
  resource: string,
  action: string,
): boolean {
  return (effectiveParticipantGrants(project, ctx)[resource] ?? []).includes(action);
}

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

  // Participant overlay: role defaults + section matrix composed with
  // matrix-override semantics (see composeParticipantPermissions).
  if (!orgAllowed && !participantAllows(project, ctx, resource, action)) {
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

  return participantAllows(project, ctx, resource, action);
}

// Resources that are org/sales surfaces, never a project-participant grant.
const NON_PARTICIPANT_RESOURCES: ReadonlySet<string> = new Set([
  "orgProfile",
  "teamMembers",
  "proposals",
  "leads",
]);

// Verbs that are destructive, authoritative, or financial sign-off. Granting any
// of these to a participant requires org owner/admin (see assertCanGrant).
const PRIVILEGED_VERBS: ReadonlySet<string> = new Set([
  "manage",
  "approve",
  "decide",
  "delete",
  "remove",
  "void",
]);

// Actions privileged beyond the verb rule: project:update mutates project scope;
// participants:manage would let the grantee re-grant (delegation of escalation).
const PRIVILEGED_OVERRIDES: ReadonlySet<string> = new Set([
  "project:update",
  "participants:manage",
]);

export function isPrivilegedGrant(resource: string, action: string): boolean {
  return PRIVILEGED_VERBS.has(action) || PRIVILEGED_OVERRIDES.has(`${resource}:${action}`);
}

/** The resource->actions catalog a participant editor may offer (org surfaces removed). */
export function grantableCatalog(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [resource, actions] of Object.entries(statement)) {
    if (NON_PARTICIPANT_RESOURCES.has(resource)) continue;
    out[resource] = [...actions];
  }
  return out;
}

/**
 * Starter role presets as grant maps (resource->actions). The editor offers
 * these as a one-click starting point; the inviter then extends or trims the
 * grants freely. Sourced from PARTICIPANT_PERMISSIONS so presets never drift
 * from the roles the system already understands. Org surfaces are filtered out.
 */
export function rolePresets(): Record<string, Record<string, string[]>> {
  const out: Record<string, Record<string, string[]>> = {};
  for (const [role, perms] of Object.entries(PARTICIPANT_PERMISSIONS)) {
    const grants: Record<string, string[]> = {};
    for (const [resource, actions] of Object.entries(perms)) {
      if (NON_PARTICIPANT_RESOURCES.has(resource)) continue;
      grants[resource] = [...actions];
    }
    out[role] = grants;
  }
  return out;
}

/** The contract side each starter role defaults to, for the invite editor. */
export function rolePresetSides(): Record<string, string> {
  return { ...ROLE_PRESET_SIDES };
}

export interface GrantValidationContext extends EnrichedAccessContext {
  isOrgAdmin: boolean;
}

/**
 * Validates a proposed participant grant map before persist. Rejects unknown or
 * non-participant resource:action pairs, and privileged grants when the inviter
 * is not org owner/admin. Returns nothing; throws ForbiddenError/BadRequest-style
 * ForbiddenError listing every offending pair.
 */
export function assertCanGrant(
  ctx: GrantValidationContext,
  grants: Record<string, readonly string[]>,
): void {
  const catalog = grantableCatalog();
  const unknown: string[] = [];
  const privileged: string[] = [];

  for (const [resource, actions] of Object.entries(grants)) {
    const allowed = catalog[resource];
    for (const action of actions) {
      if (!allowed || !allowed.includes(action)) {
        unknown.push(`${resource}:${action}`);
        continue;
      }
      if (!ctx.isOrgAdmin && isPrivilegedGrant(resource, action)) {
        privileged.push(`${resource}:${action}`);
      }
    }
  }

  if (unknown.length > 0) {
    throw new ForbiddenError(`Unknown or non-grantable permissions: ${unknown.join(", ")}`);
  }
  if (privileged.length > 0) {
    throw new ForbiddenError(
      `Only an organization owner or admin can grant: ${privileged.join(", ")}`,
    );
  }
}
