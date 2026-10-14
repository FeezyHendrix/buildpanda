import { accessFingerprint, allows, eligibleSnapshot, sameScope, type AccessScope, type AccessSnapshot } from "./access-policy";
import { permits, type AccessRequirement } from "./access-requirement";

export class AccessDeniedError extends Error {
  constructor(message = "Your current permissions do not allow this action. Connect to refresh access.") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export interface AccessState {
  scope: AccessScope | null;
  snapshot: AccessSnapshot | null;
  status: "unknown" | "loading" | "ready" | "denied";
  generation: number;
}

export type AccessTicket = AccessState & { scope: AccessScope; snapshot: AccessSnapshot; status: "ready" };

/** Pure store shared by React, SQLite, downloads and sync. No role defaults. */
export function createProjectAccessStore() {
  let state: AccessState = { scope: null, snapshot: null, status: "unknown", generation: 0 };
  const listeners = new Set<() => void>();
  const publish = (next: AccessState) => { state = next; listeners.forEach((listener) => listener()); };
  return {
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setScope(scope: AccessScope | null) {
      if (sameScope(scope, state.scope) || (!scope && !state.scope)) return;
      publish({ scope, snapshot: null, status: "unknown", generation: state.generation + 1 });
    },
    invalidate(status: AccessState["status"] = "loading") {
      publish({ ...state, snapshot: null, status, generation: state.generation + 1 });
    },
    accept(snapshot: AccessSnapshot, generation: number) {
      if (generation !== state.generation || !state.scope || !eligibleSnapshot(snapshot, state.scope)) return false;
      const changed = !state.snapshot || accessFingerprint(state.snapshot) !== accessFingerprint(snapshot);
      publish({ ...state, snapshot, status: "ready", generation: state.generation + (changed ? 1 : 0) });
      return true;
    },
    can(projectId: string | undefined, resource: string, action: string) {
      return !!projectId && state.scope?.projectId === projectId && state.status === "ready" &&
        eligibleSnapshot(state.snapshot, state.scope) && allows(state.snapshot.permissions, resource, action);
    },
  };
}

export const projectAccess = createProjectAccessStore();

export function canAccess(projectId: string | undefined, requirement: AccessRequirement): boolean {
  const state = projectAccess.getState();
  return !!projectId && state.scope?.projectId === projectId && state.status === "ready" &&
    eligibleSnapshot(state.snapshot, state.scope) && permits(requirement, (r, a) => projectAccess.can(projectId, r, a), state.snapshot.capabilities,
      (r, a) => allows(state.snapshot?.workspacePermissions, r, a));
}

export function requireAccess(projectId: string, requirement: AccessRequirement): AccessTicket {
  if (!canAccess(projectId, requirement)) throw new AccessDeniedError();
  return projectAccess.getState() as AccessTicket;
}

export function requirePermission(projectId: string, resource: string, action: string): AccessTicket {
  if (!projectAccess.can(projectId, resource, action)) throw new AccessDeniedError();
  return projectAccess.getState() as AccessTicket;
}

/** Reject asynchronous results belonging to a previous identity, scope or grant. */
export function requireCurrentAccess(ticket: AccessState): void {
  const current = projectAccess.getState();
  if (!sameScope(ticket.scope, current.scope) || ticket.generation !== current.generation ||
    !current.scope || current.status !== "ready" || !eligibleSnapshot(current.snapshot, current.scope)) {
    throw new AccessDeniedError("Project access changed. Reopen this screen before continuing.");
  }
}

let refresh: () => Promise<boolean> = async () => false;
let revoke: () => void = () => projectAccess.invalidate("denied");
export function configureAccessLifecycle(next: { refresh: () => Promise<boolean>; revoke: () => void }) {
  refresh = next.refresh;
  revoke = next.revoke;
  return () => { refresh = async () => false; revoke = () => projectAccess.invalidate("denied"); };
}
export const refreshProjectAccess = () => refresh();
export const revokeProjectAccess = () => revoke();
