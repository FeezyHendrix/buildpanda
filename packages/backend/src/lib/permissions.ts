import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export const statement = {
  ...defaultStatements,
  // Construction suite
  project: ["create", "update", "delete", "view"],
  tasks: ["view", "add", "remove"],
  // Two reads, not one. `view` is the CLIENT-FACING contract position — contract
  // sum, certificates/receivable invoices, retention, the payments on them.
  // `viewCosts` is the CONTRACTOR'S internal position — expenses, purchase
  // orders, budget vs actual, cost variance, payable invoices. On a works
  // contract the employer's Resident Engineer must see what was certified to
  // them and must never see the contractor's costs or margin, so a single flat
  // finances:view was a disclosure bug, not a convenience.
  finances: ["view", "viewCosts", "manage", "approve", "dispute"],
  schedule: ["view", "manage"],
  stages: ["view", "manage"],
  buildings: ["view", "manage"],
  documents: ["view", "upload", "delete", "markup"],
  inspections: ["view", "request", "manage"],
  materials: ["view", "manage", "report", "request", "approve"],
  contractors: ["view", "manage"],
  dailyLog: ["view", "create", "void", "report"],
  updates: ["view", "post"],
  messages: ["view", "send"],
  comments: ["view", "post"],
  participants: ["view", "manage"],
  teamMembers: ["view", "manage"],
  orgProfile: ["view", "manage"],
  rfis: ["view", "create", "respond", "manage"],
  bim: ["view", "upload", "manage"],
  approvals: ["view", "decide", "manage"],
  selections: ["view", "decide", "manage"],
  // `approve` is separate from `manage` on purpose: the contractor proposes a
  // variation, the engineer or employer decides it. Holding manage lets you
  // raise and price a change; holding approve lets you decide one you raised.
  "change-requests": ["view", "manage", "approve"],
  "key-dates": ["view", "manage"],
  permits: ["view", "manage"],
  risks: ["view", "manage"],
  // Pre-construction suite
  proposals: ["view", "create", "update", "delete", "send", "convert"],
  leads: ["view", "create", "update", "delete"],
  // verify/apply are separate grants so a quantity surveyor's sign-off is a
  // role, not a side effect of being allowed to edit a proposal.
  takeoffs: ["view", "measure", "edit", "verify", "apply"],
  estimates: ["view", "price", "terms"],
  rateCards: ["view", "manage"],
  complianceDocs: ["view", "manage"],
} as const;

export const ac = createAccessControl(statement);

type PresetShape = Partial<Record<keyof typeof statement, readonly string[]>>;

const constructionFull = {
  project: ["create", "update", "delete", "view"],
  tasks: ["view", "add", "remove"],
  finances: ["view", "viewCosts", "manage", "approve", "dispute"],
  schedule: ["view", "manage"],
  documents: ["view", "upload", "delete", "markup"],
  inspections: ["view", "request", "manage"],
  materials: ["view", "manage", "report", "request", "approve"],
  contractors: ["view", "manage"],
  dailyLog: ["view", "create", "void", "report"],
  updates: ["view", "post"],
  messages: ["view", "send"],
  comments: ["view", "post"],
  participants: ["view", "manage"],
  teamMembers: ["view", "manage"],
  orgProfile: ["view", "manage"],
  rfis: ["view", "create", "respond", "manage"],
  bim: ["view", "upload", "manage"],
  approvals: ["view", "decide", "manage"],
  selections: ["view", "decide", "manage"],
  "change-requests": ["view", "manage", "approve"],
  "key-dates": ["view", "manage"],
  permits: ["view", "manage"],
  risks: ["view", "manage"],
  stages: ["view", "manage"],
  buildings: ["view", "manage"],
} as const satisfies PresetShape;

const constructionContributor = {
  project: ["view"],
  tasks: ["view", "add", "remove"],
  finances: ["view", "viewCosts", "manage", "dispute"],
  schedule: ["view", "manage"],
  documents: ["view", "upload", "markup"],
  inspections: ["view", "request", "manage"],
  materials: ["view", "manage", "report", "request", "approve"],
  contractors: ["view", "manage"],
  dailyLog: ["view", "create", "void", "report"],
  updates: ["view", "post"],
  messages: ["view", "send"],
  comments: ["view", "post"],
  participants: ["view"],
  teamMembers: ["view", "manage"],
  orgProfile: ["view"],
  rfis: ["view", "create", "respond"],
  bim: ["view", "upload", "manage"],
  approvals: ["view", "decide", "manage"],
  selections: ["view", "decide", "manage"],
  "change-requests": ["view", "manage", "approve"],
  "key-dates": ["view", "manage"],
  permits: ["view", "manage"],
  risks: ["view", "manage"],
  stages: ["view", "manage"],
  buildings: ["view", "manage"],
} as const satisfies PresetShape;

const constructionReadOnly = {
  project: ["view"],
  tasks: ["view"],
  // An org viewer is internal staff: they read the cost position too.
  finances: ["view", "viewCosts"],
  schedule: ["view"],
  documents: ["view"],
  inspections: ["view"],
  materials: ["view", "report"],
  contractors: ["view"],
  dailyLog: ["view", "report"],
  updates: ["view"],
  messages: ["view"],
  comments: ["view"],
  participants: ["view"],
  teamMembers: ["view"],
  orgProfile: ["view"],
  rfis: ["view", "create"],
  bim: ["view"],
  approvals: ["view"],
  selections: ["view"],
  "change-requests": ["view"],
  "key-dates": ["view"],
  permits: ["view"],
  risks: ["view"],
  stages: ["view"],
  buildings: ["view"],
} as const satisfies PresetShape;

const preconFull = {
  proposals: ["view", "create", "update", "delete", "send", "convert"],
  leads: ["view", "create", "update", "delete"],
  takeoffs: ["view", "measure", "edit", "verify", "apply"],
  estimates: ["view", "price", "terms"],
  rateCards: ["view", "manage"],
  complianceDocs: ["view", "manage"],
} as const satisfies PresetShape;

const preconContributor = {
  proposals: ["view", "create", "update", "send"],
  leads: ["view", "create", "update"],
  takeoffs: ["view", "measure", "edit"],
  estimates: ["view", "price", "terms"],
  rateCards: ["view"],
  complianceDocs: ["view"],
} as const satisfies PresetShape;

const preconReadOnly = {
  proposals: ["view"],
  leads: ["view"],
  takeoffs: ["view"],
  estimates: ["view"],
  rateCards: ["view"],
  complianceDocs: ["view"],
} as const satisfies PresetShape;

export const owner = ac.newRole({
  ...ownerAc.statements,
  ...constructionFull,
  ...preconFull,
});

export const admin = ac.newRole({
  ...adminAc.statements,
  ...constructionFull,
  ...preconFull,
});

export const member = ac.newRole({
  ...memberAc.statements,
  ...constructionContributor,
  ...preconContributor,
});

export const viewer = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
  ...constructionReadOnly,
  ...preconReadOnly,
});

// The `employee` role is the DEFAULT floor for an invited employee (see
// isEmployeeRole): org-project-visible, read-only, no org-management. It grants
// almost nothing on purpose — an org admin adds capabilities (project:create,
// invitation:create, etc.) by unioning a custom role onto the member (RBAC),
// so this preset must stay minimal, never a rich set.
const constructionEmployeeBase = {
  project: ["view"],
  tasks: ["view"],
  schedule: ["view"],
  documents: ["view"],
  updates: ["view", "post"],
  messages: ["view"],
  comments: ["view"],
  participants: ["view"],
  dailyLog: ["view", "create"],
  materials: ["view", "request"],
} as const satisfies PresetShape;

export const employee = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
  ...constructionEmployeeBase,
});

export const roles = { owner, admin, member, viewer, employee };

export type AppRoleName = keyof typeof roles;

// ---------------------------------------------------------------------------
// Runtime permission resolution (Phase 2).
// Mirrors better-auth's has-permission.mjs merge so our guards and
// better-auth's org endpoints agree on the effective permission set.
// ---------------------------------------------------------------------------

export type PermissionMap = ReadonlyMap<string, ReadonlySet<string>>;

/** The four built-in org roles. Used to skip the custom-role DB query on the common path. */
export const BUILTIN_ROLES: ReadonlySet<string> = new Set(Object.keys(roles));

// An "employee" is an org member with read visibility across the org's projects.
// Their capabilities are pure RBAC — the minimal `employee` role grants almost
// nothing, and an org admin grants more via custom roles unioned onto the role
// field (e.g. "employee,foreman"), so match by token, not string equality.
export function isEmployeeRole(role: string | null | undefined): boolean {
  return (role ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .includes("employee");
}

/**
 * Resolves the effective permission map for a member's role(s) on one org.
 * Mirrors better-auth has-permission.mjs: static statements ∪ custom JSON rows.
 */
export function resolvePermissionMap(
  roleField: string,
  customRows: { role: string; permission: string }[],
): PermissionMap {
  const merged = new Map<string, Set<string>>();
  const customByName = new Map(customRows.map((r) => [r.role, r.permission]));

  for (const name of roleField.split(",").map((s) => s.trim()).filter(Boolean)) {
    // 1) Static statements for built-in roles (includes all construction + sales + org-mgmt perms)
    const statics =
      (roles as Record<string, { statements: Record<string, string[]> }>)[name]
        ?.statements ?? {};
    for (const [res, actions] of Object.entries(statics)) {
      const set = merged.get(res) ?? new Set<string>();
      actions.forEach((a) => set.add(a));
      merged.set(res, set);
    }

    // 2) Merge custom-role JSON (allow-list from zero for brand-new role names)
    const json = customByName.get(name);
    if (json) {
      const parsed = JSON.parse(json) as Record<string, string[]>;
      for (const [res, actions] of Object.entries(parsed)) {
        const set = merged.get(res) ?? new Set<string>();
        actions.forEach((a) => set.add(a));
        merged.set(res, set);
      }
    }
  }

  return merged;
}

export function mapAllows(map: PermissionMap, resource: string, action: string): boolean {
  return map.get(resource)?.has(action) ?? false;
}
