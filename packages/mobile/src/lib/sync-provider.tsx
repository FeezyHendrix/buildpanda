import NetInfo, { useNetInfo } from "@react-native-community/netinfo";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import type { SyncState } from "@/components/atoms/sync-indicator";
import type { Db } from "@/db/client";
import { flushOutbox, outboxQuery } from "@/db/outbox";
import { API_BASE_URL } from "@/lib/auth-client";
import { useLocalDb } from "@/db/provider";

const FOREGROUND_INTERVAL_MS = 60_000;

// Reachability is probed against our own API, not a generic captive-portal URL:
// on site the phone is often attached to a router with no working uplink, where
// the OS still reports a connected network. What matters is whether the backend
// answers, so /healthz is the probe.
NetInfo.configure({
  reachabilityUrl: `${API_BASE_URL.replace(/\/+$/, "")}/healthz`,
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
}: {
  db: Db;
  isOnline: boolean;
  onCounts: (counts: QueueCounts) => void;
}) {
  const query = useMemo(() => outboxQuery(db), [db]);
  const live = useLiveQuery(query);
  const wasOffline = useRef(!isOnline);

  const rows = live.data;
  useEffect(() => {
    if (!rows) return;
    onCounts({
      pendingCount: rows.filter((r) => r.status === "pending").length,
      failedCount: rows.filter((r) => r.status === "failed").length,
    });
  }, [rows, onCounts]);

  useEffect(() => {
    if (isOnline && wasOffline.current) void flushOutbox(db).catch(() => undefined);
    wasOffline.current = !isOnline;
  }, [db, isOnline]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void flushOutbox(db).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [db]);

  useEffect(() => {
    const timer = setInterval(() => {
      void flushOutbox(db).catch(() => undefined);
    }, FOREGROUND_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [db]);

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

  const [counts, setCounts] = useState<QueueCounts>({ pendingCount: 0, failedCount: 0 });

  const value = useMemo<SyncStatus>(() => {
    const state: SyncState =
      counts.failedCount > 0
        ? "error"
        : counts.pendingCount === 0
          ? "synced"
          : isOnline
            ? "syncing"
            : "pending";
    return { state, ...counts, isOnline };
  }, [counts, isOnline]);

  return (
    <SyncContext.Provider value={value}>
      {db && ready ? <QueueWatcher db={db} isOnline={isOnline} onCounts={setCounts} /> : null}
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncState(): SyncStatus {
  return useContext(SyncContext);
}
