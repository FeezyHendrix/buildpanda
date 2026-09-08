/**
 * Ability — pure, framework-free permission model.
 *
 * Usage:
 *   const ability = buildAbility("member");
 *   ability.can("create", "proposals"); // true
 *   ability.cannot("convert", "proposals"); // true
 *
 * In components use the AbilityProvider + useAbility() hook instead of
 * calling buildAbility() directly.
 */

export type Resource = "proposals" | "leads" | "takeoffs" | "estimates" | "rateCards" | "complianceDocs";
export type Action =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "send"
  | "convert"
  | "measure"
  | "edit"
  | "verify"
  | "apply"
  | "price"
  | "terms"
  | "manage";

export interface Ability {
  can(action: Action, resource: Resource): boolean;
  cannot(action: Action, resource: Resource): boolean;
}

// Single source of truth — mirrors packages/backend/src/lib/permissions.ts ROLE_PERMISSIONS.
const ROLE_ABILITIES: Record<string, Partial<Record<Resource, Action[]>>> = {
  owner: {
    proposals: ["view", "create", "update", "delete", "send", "convert"],
    leads: ["view", "create", "update", "delete"],

    takeoffs: ["view", "measure", "edit", "verify", "apply"],
    estimates: ["view", "price", "terms"],
    rateCards: ["view", "manage"],
    complianceDocs: ["view", "manage"],
  },
  admin: {
    proposals: ["view", "create", "update", "delete", "send", "convert"],
    leads: ["view", "create", "update", "delete"],

    takeoffs: ["view", "measure", "edit", "verify", "apply"],
    estimates: ["view", "price", "terms"],
    rateCards: ["view", "manage"],
    complianceDocs: ["view", "manage"],
  },
  member: {
    proposals: ["view", "create", "update", "send"],
    leads: ["view", "create", "update"],

    takeoffs: ["view", "measure", "edit"],
    estimates: ["view", "price", "terms"],
    rateCards: ["view"],
    complianceDocs: ["view"],
  },
  viewer: {
    proposals: ["view"],
    leads: ["view"],

    takeoffs: ["view"],
    estimates: ["view"],
    rateCards: ["view"],
    complianceDocs: ["view"],
  },
};

/** Build an Ability from an org role string. Null/unknown role gets no permissions. */
export function buildAbility(role: string | null | undefined): Ability {
  const perms = role ? (ROLE_ABILITIES[role] ?? {}) : {};

  function can(action: Action, resource: Resource): boolean {
    return (perms[resource] ?? []).includes(action);
  }

  return { can, cannot: (action, resource) => !can(action, resource) };
}
