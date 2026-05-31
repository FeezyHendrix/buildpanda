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

export const roles = { owner, admin, member, viewer };

export type AppRoleName = keyof typeof roles;
