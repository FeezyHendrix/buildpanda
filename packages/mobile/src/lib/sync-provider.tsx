import { useNetworkState } from "expo-network";
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
import { useLocalDb } from "@/db/provider";

const FOREGROUND_INTERVAL_MS = 60_000;

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
  const network = useNetworkState();

  // `undefined` while the first probe resolves — treat as online so a cold
  // start doesn't flash an offline badge.
  const isOnline = network.isInternetReachable !== false;

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
