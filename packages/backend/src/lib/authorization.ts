import { ForbiddenError } from "./errors.ts";
import { isEmployeeRole, mapAllows, statement, type PermissionMap } from "./permissions.ts";

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
  project_manager: {
    project: ["view"],
    tasks: ["view", "add", "remove"],
    finances: ["view"],
    schedule: ["view", "manage"],
    documents: ["view", "upload"],
    inspections: ["view", "request", "manage"],
    materials: ["view", "manage", "report", "request"],
    contractors: ["view"],
    dailyLog: ["view", "create", "report"],
    updates: ["view", "post"],
    messages: ["view", "send"],
    comments: ["view", "post"],
    participants: ["view"],
    teamMembers: ["view"],
    stages: ["view"],
    "key-dates": ["view", "manage"],
    queries: ["view", "raise", "manage"],
    rfis: ["view", "create", "respond", "manage"],
    approvals: ["view"],
    selections: ["view"],
    "change-requests": ["view", "manage"],
    "action-items": ["view", "manage"],
    permits: ["view", "manage"],
    risks: ["view", "manage"],
    bim: ["view", "upload"],
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
  materials_requester: {
    project: ["view"],
    tasks: ["view"],
    approvals: ["view"],
    selections: ["view"],
    queries: ["view", "raise"],
    "action-items": ["view"],
    stages: ["view"],
    "key-dates": ["view"],
    comments: ["view", "post"],
    updates: ["view"],
    documents: ["view"],
    inspections: ["view"],
    materials: ["view", "report", "request"],
    contractors: ["view"],
    dailyLog: ["view", "create", "report"],
    messages: ["view", "send"],
    participants: ["view"],
    teamMembers: ["view"],
    schedule: ["view"],
    rfis: ["view", "create"],
    bim: ["view"],
  },
  materials_approver: {
    project: ["view"],
    tasks: ["view"],
    approvals: ["view"],
    selections: ["view"],
    queries: ["view", "raise"],
    "action-items": ["view"],
    stages: ["view"],
    "key-dates": ["view"],
    comments: ["view", "post"],
    updates: ["view"],
    documents: ["view"],
    inspections: ["view"],
    materials: ["view", "report", "request", "approve"],
    contractors: ["view"],
    dailyLog: ["view", "create", "report"],
    messages: ["view", "send"],
    participants: ["view"],
    teamMembers: ["view"],
    schedule: ["view"],
    rfis: ["view", "create"],
    bim: ["view"],
  },
};

export type SectionValue = "hidden" | "view" | "edit";
export type ProjectSectionPermissions = Record<string, SectionValue>;

// The per-participant permission matrix (invite/edit drawer) uses dotted
// per-PAGE keys; backend auth uses resource+action. This is the single canonical
// bridge. `view`/`edit` grant only safe read/author actions — never manage,
// approve, decide or delete (those stay privileged, off the UI matrix).
const SECTION_MAP: Record<
  string,
  { resource: string; view: string[]; edit: string[]; viewExtra?: Record<string, string[]>; editExtra?: Record<string, string[]> }
> = {
  "projects.documents": { resource: "documents", view: ["view"], edit: ["view", "upload"] },
  "projects.schedule": {
    resource: "schedule",
    view: ["view"],
    edit: ["view", "manage"],
    viewExtra: { stages: ["view"], buildings: ["view"] },
    editExtra: { stages: ["view", "manage"], buildings: ["view", "manage"] },
  },
  "projects.bim": { resource: "bim", view: ["view"], edit: ["view", "upload"] },
  "quality.inspections": { resource: "inspections", view: ["view"], edit: ["view", "request"] },
  "quality.dailyLogs": { resource: "dailyLog", view: ["view", "report"], edit: ["view", "create", "report"] },
  "quality.risks": { resource: "risks", view: ["view"], edit: ["view"] },
  "commercial.finances": { resource: "finances", view: ["view"], edit: ["view"] },
  "commercial.budget": { resource: "finances", view: ["view"], edit: ["view"] },
  "commercial.invoices": { resource: "finances", view: ["view"], edit: ["view"] },
  "commercial.paymentClaims": { resource: "finances", view: ["view"], edit: ["view"] },
  "commercial.purchaseOrders": { resource: "finances", view: ["view"], edit: ["view"] },
  "commercial.materialsEquipment": { resource: "materials", view: ["view"], edit: ["view", "request"] },
  "commercial.materialsLedger": { resource: "materials", view: ["view", "report"], edit: ["view", "report"] },
  "workflow.rfis": { resource: "rfis", view: ["view"], edit: ["view", "create", "respond"], editExtra: { comments: ["view", "post"] } },
  "workflow.queries": { resource: "queries", view: ["view"], edit: ["view", "raise"], editExtra: { comments: ["view", "post"] } },
  "workflow.approvals": { resource: "approvals", view: ["view"], edit: ["view", "decide"], editExtra: { comments: ["view", "post"] } },
  "workflow.changeRequests": { resource: "change-requests", view: ["view"], edit: ["view"], editExtra: { comments: ["view", "post"] } },
  "workflow.actionItems": { resource: "action-items", view: ["view"], edit: ["view"], editExtra: { comments: ["view", "post"] } },
  "compliance.permits": { resource: "permits", view: ["view"], edit: ["view"] },
  "compliance.keyDates": { resource: "key-dates", view: ["view"], edit: ["view"] },
  "project.updates": { resource: "updates", view: ["view"], edit: ["view", "post"] },
  "collaboration.messaging": { resource: "messages", view: ["view"], edit: ["view", "send"] },
  "projects.selections": { resource: "selections", view: ["view"], edit: ["view", "decide"] },
};

// Fold a participant's section matrix into a resource->actions map. Sections
// sharing a resource union their actions; "hidden" contributes nothing. Only
// resources named by the matrix are affected — untouched resources fall through
// to the caller's precedence (role default).
export function sectionsToPermissions(
  sections: ProjectSectionPermissions,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(sections)) {
    const entry = SECTION_MAP[key];
    if (!entry || value === "hidden") continue;
    const actions = value === "edit" ? entry.edit : entry.view;
    out[entry.resource] = [...new Set([...(out[entry.resource] ?? []), ...actions])];
    if (entry.viewExtra) {
      for (const [res, extra] of Object.entries(entry.viewExtra)) {
        out[res] = [...new Set([...(out[res] ?? []), ...extra])];
      }
    }
    if (value === "edit" && entry.editExtra) {
      for (const [res, extra] of Object.entries(entry.editExtra)) {
        out[res] = [...new Set([...(out[res] ?? []), ...extra])];
      }
    }
  }
  return out;
}

// Actions the section matrix is capable of granting per resource (union of all
// view/edit bridges). The matrix may only revoke what it could have granted:
// actions outside this vocabulary (e.g. finances:dispute, materials:approve)
// stay governed by the participant's role default even when the matrix names
// the resource. editExtra grants are additive side-effects, never revocations.
const MATRIX_EXPRESSIBLE: Record<string, ReadonlySet<string>> = (() => {
  const map: Record<string, Set<string>> = {};
  for (const entry of Object.values(SECTION_MAP)) {
    const set = (map[entry.resource] ??= new Set());
    for (const action of [...entry.view, ...entry.edit]) set.add(action);
  }
  return map;
})();

/**
 * Effective participant permissions: role defaults overlaid with the
 * per-participant section matrix. When the matrix names a resource it is the
 * source of truth for that resource's matrix-expressible actions — "hidden"
 * genuinely revokes them. Resources (and non-expressible actions) the matrix
 * does not name fall through to the role default. Org permissions are NOT
 * composed here; callers keep them additive.
 */
export function composeParticipantPermissions(
  roleDefaults: Record<string, readonly string[]> | undefined,
  sections: ProjectSectionPermissions | undefined,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (sections) {
    for (const [res, actions] of Object.entries(sectionsToPermissions(sections))) {
      out[res] = [...actions];
    }
  }
  if (!roleDefaults) return out;

  const covered = new Set<string>();
  if (sections) {
    for (const key of Object.keys(sections)) {
      const entry = SECTION_MAP[key];
      if (entry) covered.add(entry.resource);
    }
  }
  for (const [resource, actions] of Object.entries(roleDefaults)) {
    const retained = covered.has(resource)
      ? actions.filter((action) => !MATRIX_EXPRESSIBLE[resource]?.has(action))
      : actions;
    if (retained.length > 0) {
      out[resource] = [...new Set([...(out[resource] ?? []), ...retained])];
    }
  }
  return out;
}

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
