import { canProjectPermission, type EnrichedAccessContext } from "../../lib/authorization.ts";

/** A whole-project report includes all of these sources, including AI insights. */
export const REPORT_PERMISSIONS: readonly [string, string][] = [
  ["project", "view"], ["tasks", "view"], ["tasks", "viewAll"],
  ["finances", "view"], ["finances", "viewCosts"], ["finances", "viewAllExpenses"],
  ["stages", "view"], ["schedule", "view"], ["key-dates", "view"],
  ["rfis", "view"], ["change-requests", "view"], ["approvals", "view"],
  ["materials", "view"], ["permits", "view"], ["risks", "view"],
  ["inspections", "view"], ["updates", "view"], ["dailyLog", "view"],
  ["documents", "view"], ["selections", "view"],
];

export function canReadReporting(project: { id: string; ownerId: string | null; organizationId: string | null }, ctx: EnrichedAccessContext): boolean {
  // The report also counts internal RFIs. Keep the RFI record-level boundary.
  const readsInternal = project.ownerId === ctx.userId || !!(project.organizationId && ctx.orgRoles.has(project.organizationId));
  return readsInternal && REPORT_PERMISSIONS.every(([resource, action]) => canProjectPermission(project, ctx, resource, action));
}
