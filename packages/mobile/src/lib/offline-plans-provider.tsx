import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useLocalDb } from "@/db/provider";
import { useFieldSession } from "./field-session";
import { syncProjectDocuments, type PlanDownloadProgress } from "./project-documents-sync";
import { useSyncState } from "./sync-provider";

const INITIAL_PROGRESS: PlanDownloadProgress = { completed: 0, total: 0, failed: 0, error: null };
const OfflinePlansContext = createContext({ ...INITIAL_PROGRESS, syncing: false, retry: () => {} });

/** Project selection, reconnect and foreground all refresh the durable plan cache. */
export function OfflinePlansProvider({ children }: { children: ReactNode }) {
  const { db, ready } = useLocalDb();
  const { projectId } = useFieldSession();
  const { isOnline } = useSyncState();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ projectId, db, ...INITIAL_PROGRESS, syncing: false });

  useEffect(() => {
    if (!db || !ready || !projectId || !isOnline) return;
    let cancelled = false;
    let running = false;
    const refresh = async () => {
      if (cancelled || running || (AppState.currentState && AppState.currentState !== "active")) return;
      running = true;
      setState({ projectId, db, ...INITIAL_PROGRESS, syncing: true });
      try {
        await syncProjectDocuments(db, projectId, (progress) => {
          if (!cancelled) setState({ projectId, db, ...progress, syncing: true });
        }, () => cancelled);
      } catch (error) {
        if (!cancelled) setState({ projectId, db, ...INITIAL_PROGRESS, syncing: false,
          error: error instanceof Error ? error.message : "Couldn't prepare plans for offline use." });
      } finally {
        running = false;
        if (!cancelled) setState((current) => ({ ...current, syncing: false }));
      }
    };
    void refresh();
    const listener = AppState.addEventListener("change", (next) => { if (next === "active") void refresh(); });
    const timer = setInterval(() => void refresh(), 60_000);
    return () => { cancelled = true; listener.remove(); clearInterval(timer); };
  }, [db, ready, projectId, isOnline, attempt]);

  const progress = state.db === db && state.projectId === projectId ? state : { ...INITIAL_PROGRESS, syncing: false };
  return (
    <OfflinePlansContext.Provider value={{ ...progress, syncing: isOnline && progress.syncing, retry: () => setAttempt((value) => value + 1) }}>
      {children}
    </OfflinePlansContext.Provider>
  );
}

export const useOfflinePlans = () => useContext(OfflinePlansContext);
