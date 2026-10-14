/** Resource/action grants come only from GET /projects/:id/access. */
export type Permission = readonly [resource: string, action: string];
export type PermissionMap = Readonly<Record<string, readonly string[]>>;
export interface AccessScope {
  userId: string;
  organizationId: string;
  projectId: string;
}
export interface AccessSnapshot extends AccessScope {
  permissions: PermissionMap;
  workspacePermissions: PermissionMap;
  capabilities: Readonly<Record<string, boolean>>;
  relationship: string;
  verifiedAt: number;
  version: 1;
}

// Product policy: a crew may work disconnected for at most 24 hours.
export const OFFLINE_ACCESS_MS = 24 * 60 * 60 * 1000;
export const sameScope = (a: AccessScope | null, b: AccessScope | null): boolean =>
  !!a && !!b && a.userId === b.userId && a.organizationId === b.organizationId && a.projectId === b.projectId;
export const scopeKey = (scope: AccessScope): string =>
  JSON.stringify([scope.userId, scope.organizationId, scope.projectId]);

export function validPermissions(value: unknown): value is PermissionMap {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    Object.values(value).every((actions) => Array.isArray(actions) && actions.every((a) => typeof a === "string"));
}

export function eligibleSnapshot(value: unknown, scope: AccessScope, now = Date.now()): value is AccessSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as AccessSnapshot;
  return snapshot.version === 1 && sameScope(snapshot, scope) && validPermissions(snapshot.permissions) &&
    validPermissions(snapshot.workspacePermissions) &&
    !!snapshot.capabilities && typeof snapshot.capabilities === "object" && !Array.isArray(snapshot.capabilities) &&
    Object.values(snapshot.capabilities).every((value) => typeof value === "boolean") && typeof snapshot.relationship === "string" &&
    Number.isFinite(snapshot.verifiedAt) && snapshot.verifiedAt <= now && now - snapshot.verifiedAt < OFFLINE_ACCESS_MS;
}

export const allows = (permissions: PermissionMap | null | undefined, resource: string, action: string): boolean =>
  permissions?.[resource]?.includes(action) === true;

export const accessFingerprint = (snapshot: Pick<AccessSnapshot, "permissions" | "workspacePermissions" | "capabilities" | "relationship">) =>
  JSON.stringify([snapshot.permissions, snapshot.workspacePermissions, snapshot.capabilities, snapshot.relationship]);

export function canDecideMaterial(
  permissions: PermissionMap | undefined, userId: string | undefined,
  record: { status: string; requestedReviewerId: string | null },
): boolean {
  return !!userId && allows(permissions, "materials", "approve") && ["Pending", "Resubmit"].includes(record.status) &&
    (!record.requestedReviewerId || record.requestedReviewerId === userId);
}

export function canRespondToRfi(
  permissions: PermissionMap | undefined, userId: string | undefined,
  record: { status: string; ballInCourtId: string | null },
): boolean {
  return !!userId && allows(permissions, "rfis", "respond") && !["Closed", "Void"].includes(record.status) &&
    allows(permissions, "rfis", "manage");
}
