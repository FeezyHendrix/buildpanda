import NetInfo, { useNetInfo } from "@react-native-community/netinfo";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { focusManager, onlineManager } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";
import type { SyncState } from "@/components/atoms/sync-indicator";
import type { Db } from "@/db/client";
import { flushOutbox, outboxQuery, type FlushResult } from "@/db/outbox";
import { API_BASE_URL } from "@/lib/auth-client";
import { useLocalDb } from "@/db/provider";

const FOREGROUND_INTERVAL_MS = 60_000;

// Reachability is probed against our own API, not a generic captive-portal URL:
// on site the phone is often attached to a router with no working uplink, where
// the OS still reports a connected network. What matters is whether the backend
// answers, so /healthz is the probe.
NetInfo.configure({
  reachabilityUrl: `${API_BASE_URL.replace(/\/+$/, "")}/healthz`,
  // NetInfo defaults to HEAD, but the public health route only allows GET.
  // HEAD returns 401 and incorrectly leaves a connected device offline.
  reachabilityMethod: "GET",
  reachabilityTest: async (response) => response.status === 200,
  reachabilityLongTimeout: 60_000,
  reachabilityShortTimeout: 5_000,
  reachabilityRequestTimeout: 10_000,
  reachabilityShouldRun: () => true,
  useNativeReachability: false,
});

interface SyncStatus {
  state: SyncState;
  pendingCount: number;
  failedCount: number;
  isOnline: boolean;
  needsSignIn: boolean;
  syncNow: () => Promise<FlushResult | undefined>;
}

interface QueueCounts {
  pendingCount: number;
  failedCount: number;
}

const SyncContext = createContext<SyncStatus>({
  state: "synced",
  pendingCount: 0,
  failedCount: 0,
  isOnline: true,
  needsSignIn: false,
  syncNow: async () => undefined,
});

/**
 * Watches the outbox and drives it.
 *
 * Mounted only once the database is open, so the live query always has a real
 * query. There is no reliable background execution on iOS — nothing drains
 * while the app is closed, so Ernest's 15-minute background tasks have no
 * equivalent here. These are the triggers that actually fire: reconnecting,
 * returning to the foreground, a timer while open, and immediately after a
 * local write (repositories call flushOutbox themselves).
 */
function QueueWatcher({
  db,
  isOnline,
  onCounts,
  syncNow,
}: {
  db: Db;
  isOnline: boolean;
  onCounts: (counts: QueueCounts) => void;
  syncNow: () => Promise<FlushResult | undefined>;
}) {
  const query = useMemo(() => outboxQuery(db), [db]);
  const live = useLiveQuery(query, [query]);

  const rows = live.data;
  useEffect(() => {
    if (!rows) return;
    onCounts({
      pendingCount: rows.filter((r) => r.status === "pending").length,
      failedCount: rows.filter((r) => r.status === "failed").length,
    });
  }, [rows, onCounts]);

  useEffect(() => {
    if (!isOnline) return;
    const sync = () => {
      if (AppState.currentState === "active" || AppState.currentState === null) {
        void syncNow().catch(() => undefined);
      }
    };
    sync();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") sync();
    });
    const timer = setInterval(sync, FOREGROUND_INTERVAL_MS);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [db, isOnline, syncNow]);

  return null;
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { db, ready } = useLocalDb();
  const network = useNetInfo();

  // Three states, not two. null means the first probe has not resolved, and is
  // treated as online so a cold start does not flash an offline badge; once
  // either signal says false the device is offline. The previous check read
  // `isInternetReachable !== false`, so an unresolved probe pinned the app
  // online for good.
  const isOnline = network.isConnected !== false && network.isInternetReachable !== false;

  useEffect(() => {
    onlineManager.setOnline(isOnline);
  }, [isOnline]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    focusManager.setFocused(AppState.currentState === "active");
    const listener = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(state === "active");
      if (state === "active") void NetInfo.refresh().catch(() => undefined);
    });
    return () => listener.remove();
  }, []);

  const [counts, setCounts] = useState<QueueCounts>({ pendingCount: 0, failedCount: 0 });
  const [syncing, setSyncing] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  useEffect(() => {
    setCounts({ pendingCount: 0, failedCount: 0 });
    setNeedsSignIn(false);
  }, [db]);

  const syncNow = useCallback(async () => {
    if (!db || !ready || !isOnline) return;
    setSyncing(true);
    try {
      const result = await flushOutbox(db);
      setNeedsSignIn(result.pausedForAuth);
      return result;
    } finally {
      setSyncing(false);
    }
  }, [db, ready, isOnline]);

  const value = useMemo<SyncStatus>(() => {
    const state: SyncState =
      needsSignIn || counts.failedCount > 0
        ? "error"
        : counts.pendingCount === 0
          ? "synced"
          : syncing && isOnline
            ? "syncing"
            : "pending";
    return { state, ...counts, isOnline, needsSignIn, syncNow };
  }, [counts, isOnline, needsSignIn, syncing, syncNow]);

  return (
    <SyncContext.Provider value={value}>
      {db && ready ? <QueueWatcher db={db} isOnline={isOnline} onCounts={setCounts} syncNow={syncNow} /> : null}
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncState(): SyncStatus {
  return useContext(SyncContext);
}
