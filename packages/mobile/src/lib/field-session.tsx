import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { storage } from "./storage";
import { authClient, useSession } from "./auth-client";
import { writeCachedUser } from "./session-cache";
import { useAuthGate } from "./use-auth-gate";

/**
 * Which project this device is working out of.
 *
 * Persisted because a phone cold-starts on site with no navigation history, and
 * because it is the partition key for offline data. The record carries the
 * identity and workspace that chose it so a different sign-in can never inherit
 * the previous person's project.
 */
const STORAGE_KEY = "buildpanda_field_scope";

interface PersistedScope {
  userId: string;
  organizationId: string;
  projectId: string;
}

interface FieldSession {
  userId: string | undefined;
  organizationId: string | undefined;
  projectId: string | undefined;
  /** Owner of any locally cached rows. Offline storage partitions on this alone. */
  storageOwnerId: string | undefined;
  isReady: boolean;
  selectProject: (projectId: string) => void;
  clearProject: () => void;
}

const FieldSessionContext = createContext<FieldSession>({
  userId: undefined,
  organizationId: undefined,
  projectId: undefined,
  storageOwnerId: undefined,
  isReady: false,
  selectProject: () => undefined,
  clearProject: () => undefined,
});

function isPersistedScope(value: unknown): value is PersistedScope {
  if (typeof value !== "object" || value === null) return false;
  const scope = value as Record<string, unknown>;
  return (
    typeof scope.userId === "string" &&
    typeof scope.organizationId === "string" &&
    typeof scope.projectId === "string"
  );
}

function readScope(): PersistedScope | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPersistedScope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeScope(scope: PersistedScope | null): void {
  try {
    if (scope) storage.setItem(STORAGE_KEY, JSON.stringify(scope));
    else storage.removeItem(STORAGE_KEY);
  } catch {
    // Keychain unavailable — the scope still works for this app session.
  }
}

export function FieldSessionProvider({ children }: { children: ReactNode }) {
  const { user, isResolving } = useAuthGate();
  const { data: liveSession } = useSession();

  const [scope, setScope] = useState<PersistedScope | null>(readScope);

  const liveOrganizationId = liveSession?.session.activeOrganizationId ?? undefined;

  // Offline the live session is absent, so the persisted workspace stands in.
  // Without this the org reads as `undefined`, the scope looks stale, and the
  // crew member loses their project the moment they lose signal.
  const organizationId = liveOrganizationId ?? scope?.organizationId;

  // Only a *confirmed* mismatch invalidates the scope — never a missing session.
  const isStale =
    scope !== null &&
    user !== null &&
    (scope.userId !== user.id ||
      (liveOrganizationId !== undefined && scope.organizationId !== liveOrganizationId));

  const projectId = scope !== null && !isStale ? scope.projectId : undefined;

  useEffect(() => {
    if (isStale) {
      writeScope(null);
      setScope(null);
    }
  }, [isStale]);

  const selectProject = useCallback(
    (nextProjectId: string) => {
      if (!user || !organizationId) return;
      const next: PersistedScope = {
        userId: user.id,
        organizationId,
        projectId: nextProjectId,
      };
      setScope(next);
      writeScope(next);
    },
    [user, organizationId],
  );

  const clearProject = useCallback(() => {
    setScope(null);
    writeScope(null);
  }, []);

  const value = useMemo<FieldSession>(
    () => ({
      userId: user?.id,
      organizationId,
      projectId,
      storageOwnerId: user?.id,
      isReady: !isResolving,
      selectProject,
      clearProject,
    }),
    [user, organizationId, projectId, isResolving, selectProject, clearProject],
  );

  return <FieldSessionContext.Provider value={value}>{children}</FieldSessionContext.Provider>;
}

export function useFieldSession(): FieldSession {
  return useContext(FieldSessionContext);
}

/** The only path that ends a session — everything else keeps the user signed in. */
export async function signOutAndClearScope(): Promise<void> {
  writeScope(null);
  writeCachedUser(null);
  await authClient.signOut();
}
