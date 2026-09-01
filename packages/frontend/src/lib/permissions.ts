import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export const statement = {
  ...defaultStatements,
  project: ["create", "update", "delete", "view"],
  tasks: ["view", "add", "remove"],
  // Governs the whole finance surface, expenses/receipts included — mirrors the
  // backend statement, where the separate `transactions` resource was folded in.
  finances: ["view", "manage", "approve", "dispute"],
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
  queries: ["view", "raise", "manage"],
  "change-requests": ["view", "manage"],
  "action-items": ["view", "manage"],
  "key-dates": ["view", "manage"],
  permits: ["view", "manage"],
  risks: ["view", "manage"],
  proposals: ["view", "create", "update", "delete", "send", "convert"],
  leads: ["view", "create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

const constructionFull = {
  project: ["create", "update", "delete", "view"],
  tasks: ["view", "add", "remove"],
  finances: ["view", "manage", "approve", "dispute"],
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
  queries: ["view", "raise", "manage"],
  "change-requests": ["view", "manage"],
  "action-items": ["view", "manage"],
  "key-dates": ["view", "manage"],
  permits: ["view", "manage"],
  risks: ["view", "manage"],
} as const;

const constructionContributor = {
  project: ["view"],
  tasks: ["view", "add", "remove"],
  finances: ["view", "manage", "dispute"],
  schedule: ["view", "manage"],
  stages: ["view", "manage"],
  buildings: ["view", "manage"],
  documents: ["view", "upload", "markup"],
  inspections: ["view", "request", "manage"],
  materials: ["view", "manage", "report", "request", "approve"],
  contractors: ["view", "manage"],
  dailyLog: ["view", "create", "void", "report"],
  updates: ["view", "post"],
  messages: ["view", "send"],
  comments: ["view", "post"],
  participants: ["view"],
  teamMembers: ["view"],
  orgProfile: ["view"],
  rfis: ["view", "create", "respond"],
  bim: ["view", "upload", "manage"],
  approvals: ["view", "decide", "manage"],
  selections: ["view", "decide", "manage"],
  queries: ["view", "raise", "manage"],
  "change-requests": ["view", "manage"],
  "action-items": ["view", "manage"],
  "key-dates": ["view", "manage"],
  permits: ["view", "manage"],
  risks: ["view", "manage"],
} as const;

const constructionReadOnly = {
  project: ["view"],
  tasks: ["view"],
  finances: ["view"],
  schedule: ["view"],
  stages: ["view"],
  buildings: ["view"],
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
  queries: ["view"],
  "change-requests": ["view"],
  "action-items": ["view"],
  "key-dates": ["view"],
  permits: ["view"],
  risks: ["view"],
} as const;

export const owner = ac.newRole({
  ...ownerAc.statements,
  ...constructionFull,
});

export const admin = ac.newRole({
  ...adminAc.statements,
  ...constructionFull,
});

export const member = ac.newRole({
  ...memberAc.statements,
  ...constructionContributor,
});

export const viewer = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
  ...constructionReadOnly,
});

// Mirror of the backend `employee` floor: minimal, project-scoped, no
// team-management. Real capabilities are admin-assigned via custom roles.
const constructionEmployeeBase = {
  project: ["view"],
  tasks: ["view"],
  schedule: ["view"],
  documents: ["view"],
  updates: ["view"],
  messages: ["view"],
  comments: ["view"],
  dailyLog: ["view"],
  materials: ["view"],
} as const;

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

// Presentation mirror of the backend rule: an employee is scoped to assigned
// projects and cannot manage the team. Backend enforces this; the UI hides
// team-management for these members. Role may be comma-joined with a custom
// role (e.g. "employee,foreman"), so match by token.
export function isEmployeeRole(role: string | null | undefined): boolean {
  return (role ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .includes("employee");
}

export const STATIC_ROLE_NAMES: AppRoleName[] = [
  "owner",
  "admin",
  "member",
  "viewer",
  "employee",
];

export const ORG_MANAGEMENT_RESOURCES = [
  "organization",
  "member",
  "invitation",
  "ac",
] as const;

export const PROJECT_RESOURCES = [
  "project",
  "tasks",
  "finances",
  "schedule",
  "stages",
  "buildings",
  "documents",
  "inspections",
  "materials",
  "contractors",
  "dailyLog",
  "updates",
  "messages",
  "comments",
  "participants",
  "teamMembers",
  "orgProfile",
  "rfis",
  "bim",
  "approvals",
  "selections",
  "queries",
  "change-requests",
  "action-items",
  "key-dates",
  "permits",
  "risks",
] as const;

export const SALES_RESOURCES = ["proposals", "leads"] as const;
