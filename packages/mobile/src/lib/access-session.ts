import { accessFingerprint, eligibleSnapshot, sameScope, type AccessScope, type AccessSnapshot } from "./access-policy";
import type { createProjectAccessStore } from "./project-access-store";

interface AccessSessionDependencies {
  scope: AccessScope;
  store: ReturnType<typeof createProjectAccessStore>;
  saved: unknown;
  fetch: () => Promise<AccessSnapshot>;
  save: (snapshot: AccessSnapshot) => void;
  purge: () => Promise<void>;
}

/** Connectivity and refresh races are independent of React and native storage. */
export function createAccessSession({ scope, store, saved, fetch, save, purge }: AccessSessionDependencies) {
  let active = true;
  let mode: "unknown" | "online" | "offline" = "unknown";
  let lastSnapshot = eligibleSnapshot(saved, scope) ? saved : null;
  let inFlight: Promise<boolean> | null = null;
  let cleanup = Promise.resolve();
  const clear = () => { cleanup = cleanup.catch(() => undefined).then(purge); return cleanup; };
  const isOffline = () => mode === "offline";
  const current = () => active && sameScope(store.getState().scope, scope);
  const revoke = () => {
    if (!current()) return;
    lastSnapshot = null;
    store.invalidate("denied");
    void clear().catch(() => undefined); // Denial remains effective even if cleanup fails.
  };
  const restore = () => {
    if (current() && store.getState().status === "unknown" && eligibleSnapshot(lastSnapshot, scope)) {
      store.accept(lastSnapshot, store.getState().generation);
    }
  };
  const refresh = (): Promise<boolean> => {
    if (inFlight) return inFlight;
    // "unknown" connectivity must still try: the fetch itself is the real
    // probe, and refusing until NetInfo says online left the Refresh button a
    // silent no-op on networks whose reachability ping never resolves.
    if (!current() || mode === "offline") return Promise.resolve(false);
    let generation = store.getState().generation;
    inFlight = (async () => {
      try {
        await cleanup;
        const snapshot = await fetch();
        if (!current() || store.getState().generation !== generation) return false;
        if (!eligibleSnapshot(snapshot, scope)) throw new Error("Invalid project access");
        // Compare even an expired saved snapshot before exposing old disk data.
        const previous = lastSnapshot ?? saved;
        if (previous && typeof previous === "object" && accessFingerprint(previous as AccessSnapshot) !== accessFingerprint(snapshot)) {
          // A known change stops readers and in-flight writes before asynchronous cleanup.
          store.invalidate("loading");
          generation = store.getState().generation;
          await clear();
        }
        if (!current() || !store.accept(snapshot, generation)) return false;
        lastSnapshot = snapshot;
        save(snapshot);
        return true;
      } catch (error) {
        if (!current() || store.getState().generation !== generation) return false;
        const status = (error as { status?: number })?.status;
        // Only the server saying "no" revokes. A timeout or 5xx on site signal
        // must not purge a still-eligible 24h-verified snapshot — "unknown"
        // grants nothing but leaves the next attempt something to restore.
        if (status === 401 || status === 403) revoke();
        else if (eligibleSnapshot(lastSnapshot, scope)) {
          store.invalidate("unknown");
          restore();
        } else store.invalidate("unknown");
        return false;
      } finally { inFlight = null; }
    })();
    return inFlight;
  };
  return {
    refresh,
    revoke,
    connectivity(connected: boolean | null, reachable: boolean | null) {
      if (!current()) return;
      // reachable === null means NetInfo's probe hasn't answered (it may
      // never: its ping URL is blocked on some site networks). Treat a
      // connected device as online and let the access fetch decide — waiting
      // for true deadlocked the whole session in "unknown".
      if (connected === false || reachable === false) { mode = "offline"; restore(); }
      else if (connected === true) {
        const reconnecting = mode !== "online";
        mode = "online";
        if (reconnecting) {
          store.invalidate("loading");
          // Finish a stale request before starting the reconnect verification.
          if (inFlight) { void inFlight.then(() => refresh()); return; }
        }
        void refresh();
      }
    },
    foreground() {
      if (!current()) return;
      if (mode !== "offline") {
        store.invalidate("loading");
        if (inFlight) void inFlight.then(() => refresh()); else void refresh();
      } else if (!eligibleSnapshot(store.getState().snapshot, scope)) revoke();
    },
    tick() {
      if (!current()) return;
      if (store.getState().snapshot && !eligibleSnapshot(store.getState().snapshot, scope)) revoke();
      if (mode === "online") void refresh();
    },
    close() { active = false; },
  };
}
