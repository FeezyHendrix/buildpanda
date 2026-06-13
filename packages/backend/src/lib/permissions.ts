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
  finances: ["view", "manage", "approve"],
  schedule: ["view", "manage"],
  documents: ["view", "upload", "delete"],
  inspections: ["view", "request", "manage"],
  materials: ["view", "manage"],
  contractors: ["view", "manage"],
  dailyLog: ["view", "create"],
  updates: ["view", "post"],
  messages: ["view", "send"],
  // Pre-construction suite
  proposals: ["view", "create", "update", "delete", "send", "convert"],
  leads: ["view", "create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

const constructionFull = {
  project: ["create", "update", "delete", "view"],
  finances: ["view", "manage", "approve"],
  schedule: ["view", "manage"],
  documents: ["view", "upload", "delete"],
  inspections: ["view", "request", "manage"],
  materials: ["view", "manage"],
  contractors: ["view", "manage"],
  dailyLog: ["view", "create"],
  updates: ["view", "post"],
  messages: ["view", "send"],
} as const;

const constructionContributor = {
  project: ["view"],
  finances: ["view"],
  schedule: ["view"],
  documents: ["view", "upload"],
  inspections: ["view", "request"],
  materials: ["view"],
  contractors: ["view"],
  dailyLog: ["view", "create"],
  updates: ["view", "post"],
  messages: ["view", "send"],
} as const;

const constructionReadOnly = {
  project: ["view"],
  finances: ["view"],
  schedule: ["view"],
  documents: ["view"],
  inspections: ["view"],
  materials: ["view"],
  contractors: ["view"],
  dailyLog: ["view"],
  updates: ["view"],
  messages: ["view"],
} as const;

export const owner = ac.newRole({
  ...ownerAc.statements,
  ...constructionFull,
  proposals: ["view", "create", "update", "delete", "send", "convert"],
  leads: ["view", "create", "update", "delete"],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  ...constructionFull,
  proposals: ["view", "create", "update", "delete", "send", "convert"],
  leads: ["view", "create", "update", "delete"],
});

export const member = ac.newRole({
  ...memberAc.statements,
  ...constructionContributor,
  // Members do daily sales work but can't delete records or trigger conversion
  proposals: ["view", "create", "update", "send"],
  leads: ["view", "create", "update"],
});

export const viewer = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
  ...constructionReadOnly,
  proposals: ["view"],
  leads: ["view"],
});

export const roles = { owner, admin, member, viewer };

export type AppRoleName = keyof typeof roles;

// ---------------------------------------------------------------------------
// Runtime permission check — used by requireOrgPermission() in auth-context.
// Kept as a plain lookup so it works without calling the AC library at runtime.
// ---------------------------------------------------------------------------

const ROLE_PERMISSIONS: Record<string, Record<string, readonly string[]>> = {
  owner:  {
    proposals: ["view", "create", "update", "delete", "send", "convert"],
    leads:     ["view", "create", "update", "delete"],
  },
  admin:  {
    proposals: ["view", "create", "update", "delete", "send", "convert"],
    leads:     ["view", "create", "update", "delete"],
  },
  member: {
    proposals: ["view", "create", "update", "send"],
    leads:     ["view", "create", "update"],
  },
  viewer: {
    proposals: ["view"],
    leads:     ["view"],
  },
};

export function hasPermission(role: string, resource: string, action: string): boolean {
  return (ROLE_PERMISSIONS[role]?.[resource] ?? []).includes(action);
}
