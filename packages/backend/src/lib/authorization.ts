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
  // Per-participant page-access matrix keyed by project id. When present it is
  // the source of truth for that participant (overrides role defaults); absent
  // means fall back to the role default.
  projectSectionPermissions?: ReadonlyMap<string, ProjectSectionPermissions>;
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
const SECTION_MAP: Record<string, { resource: string; view: string[]; edit: string[] }> = {
  "projects.documents": { resource: "documents", view: ["view"], edit: ["view", "upload"] },
  "projects.schedule": { resource: "schedule", view: ["view"], edit: ["view", "manage"] },
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
  "workflow.rfis": { resource: "rfis", view: ["view"], edit: ["view", "create", "respond"] },
  "workflow.queries": { resource: "queries", view: ["view"], edit: ["view", "raise"] },
  "workflow.approvals": { resource: "approvals", view: ["view"], edit: ["view", "decide"] },
  "workflow.changeRequests": { resource: "change-requests", view: ["view"], edit: ["view"] },
  "workflow.actionItems": { resource: "action-items", view: ["view"], edit: ["view"] },
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
  }
  return out;
}

// True when the participant matrix explicitly grants (view or edit) the section
// whose resource+action is being checked. Used to overlay per-participant grants
// on top of role defaults inside canProjectPermission.
function matrixAllows(
  sections: ProjectSectionPermissions | undefined,
  resource: string,
  action: string,
): boolean {
  if (!sections) return false;
  const perms = sectionsToPermissions(sections);
  return (perms[resource] ?? []).includes(action);
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

  const sections = project.id ? ctx.projectSectionPermissions?.get(project.id) : undefined;
  if (matrixAllows(sections, resource, action)) return true;

  const pRole = participantRole(project, ctx);
  const pPerms = pRole ? PARTICIPANT_PERMISSIONS[pRole] : undefined;
  return pPerms ? (pPerms[resource] ?? []).includes(action) : false;
}
