import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import { AppState } from "react-native";
import { projectAccessApi } from "@/api/project-access";
import { clearProjectServerCache } from "@/db/access-cleanup";
import { useLocalDb } from "@/db/provider";
import { eligibleSnapshot, sameScope, OFFLINE_ACCESS_MS, type AccessScope, type AccessSnapshot } from "./access-policy";
import { clearDocumentCache } from "./download-file";
import { useFieldSession } from "./field-session";
import { canAccess, configureAccessLifecycle, projectAccess } from "./project-access-store";
import type { AccessRequirement } from "./access-requirement";
import { queryStorage } from "./query-storage";
import { storage } from "./storage";

import { createAccessSession } from "./access-session";
import { SNAPSHOT_KEY } from "./access-storage";

export function ProjectAccessProvider({ children }: { children: ReactNode }) {
  const { userId, organizationId, projectId } = useFieldSession();
  const { db } = useLocalDb();
  const queries = useQueryClient();

  useLayoutEffect(() => {
    const scope: AccessScope | null = userId && organizationId && projectId ? { userId, organizationId, projectId } : null;
    projectAccess.setScope(scope);
    // Cached query objects never travel across identity/workspace/project changes.
    queries.clear();
    if (!scope) return;
    let saved: unknown = null;
    try { saved = JSON.parse(storage.getItem(SNAPSHOT_KEY) ?? "null"); } catch { /* Unknown access stays denied. */ }
    const session = createAccessSession({
      scope, store: projectAccess, saved,
      fetch: async () => {
        const response = await projectAccessApi.get(scope.projectId);
        return { ...response, verifiedAt: Date.now(), version: 1 } as AccessSnapshot;
      },
      save: (snapshot) => storage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)),
      purge: async () => {
        if (sameScope(projectAccess.getState().scope, scope)) {
          storage.removeItem(SNAPSHOT_KEY);
          queryStorage.clearProtected();
          queries.clear();
        }
        const results = await Promise.allSettled([
          Promise.resolve().then(() => { if (db) clearProjectServerCache(db, scope.projectId); }),
          clearDocumentCache(scope),
        ]);
        if (results.some((result) => result.status === "rejected")) throw new Error("Protected cache cleanup failed.");
      },
    });
    const lifecycle = configureAccessLifecycle(session);
    const unsubscribe = NetInfo.addEventListener((network) => session.connectivity(network.isConnected, network.isInternetReachable));
    const foreground = AppState.addEventListener("change", (next) => { if (next === "active") session.foreground(); });
    const timer = setInterval(() => { if (AppState.currentState === "active") session.tick(); }, 30_000);
    // Resolve initial connectivity before allowing cached access or synchronization.
    void NetInfo.refresh();
    return () => { session.close(); lifecycle(); unsubscribe(); foreground.remove(); clearInterval(timer); };
  }, [userId, organizationId, projectId, db, queries]);

  const state = useSyncExternalStore(projectAccess.subscribe, projectAccess.getState, projectAccess.getState);
  useEffect(() => {
    if (!state.snapshot) return;
    const timer = setTimeout(() => projectAccess.invalidate("unknown"), Math.max(0, state.snapshot.verifiedAt + OFFLINE_ACCESS_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [state.snapshot]);
  return children;
}

export function useProjectAccess() {
  const { userId, organizationId, projectId } = useFieldSession();
  const state = useSyncExternalStore(projectAccess.subscribe, projectAccess.getState, projectAccess.getState);
  const scope = userId && organizationId && projectId ? { userId, organizationId, projectId } : null;
  const ready = !!scope && sameScope(scope, state.scope) && state.status === "ready" && eligibleSnapshot(state.snapshot, scope);
  const can = useCallback((resource: string, action: string) => ready && projectAccess.can(projectId, resource, action), [ready, projectId, state.generation]);
  const allows = useCallback((requirement: AccessRequirement) => ready && canAccess(projectId, requirement), [ready, projectId, state.generation]);
  return { ...state, ready, isKnown: ready, can, allows, permissions: ready ? state.snapshot?.permissions : undefined, userId };
}
