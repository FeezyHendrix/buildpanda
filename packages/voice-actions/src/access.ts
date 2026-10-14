export type Permission = readonly [resource: string, action: string];

/** A small policy expression, shared by views, routes, queries and writes. */
export type AccessRequirement =
  | { readonly permission: Permission }
  | { readonly capability: string }
  | { readonly workspacePermission: Permission }
  | { readonly all: readonly AccessRequirement[] }
  | { readonly any: readonly AccessRequirement[] };

export const grant = (resource: string, action: string): AccessRequirement => ({ permission: [resource, action] });
export const capability = (name: string): AccessRequirement => ({ capability: name });
export const workspaceGrant = (resource: string, action: string): AccessRequirement => ({ workspacePermission: [resource, action] });
export const allOf = (...all: AccessRequirement[]): AccessRequirement => ({ all });
export const anyOf = (...any: AccessRequirement[]): AccessRequirement => ({ any });
export const DENY = anyOf();
export const VERIFIED = allOf();

export function permits(requirement: AccessRequirement, can: (resource: string, action: string) => boolean, capabilities: Readonly<Record<string, boolean>> = {}, workspaceCan: (resource: string, action: string) => boolean = () => false): boolean {
  if ("permission" in requirement) return can(...requirement.permission);
  if ("capability" in requirement) return capabilities[requirement.capability] === true;
  if ("workspacePermission" in requirement) return workspaceCan(...requirement.workspacePermission);
  if ("all" in requirement) return requirement.all.every((rule) => permits(rule, can, capabilities, workspaceCan));
  return requirement.any.some((rule) => permits(rule, can, capabilities, workspaceCan));
}

export interface FeatureAccess {
  readonly resource: string;
  readonly read: AccessRequirement;
  readonly actions: Readonly<Record<string, AccessRequirement>>;
}

/** Actions include the read needed to use the associated field record. */
export function defineFeature<const T extends Record<string, string | AccessRequirement>>(
  resource: string, actions: T, readAction: string | AccessRequirement = "view",
) {
  const read = typeof readAction === "string" ? grant(resource, readAction) : readAction;
  const policies = Object.fromEntries(Object.entries(actions).map(([name, action]) =>
    [name, allOf(read, typeof action === "string" ? grant(resource, action) : action)],
  )) as { readonly [K in keyof T]: AccessRequirement };
  return { resource, read, actions: policies } satisfies FeatureAccess;
}
