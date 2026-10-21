import { useEffect, useState } from "react";
import { useSession } from "./auth-client";
import { readCachedUser, subscribeCachedUser, writeCachedUser, type CachedUser } from "./session-cache";

interface AuthGate {
  user: CachedUser | null;
  /** True only on a genuinely cold start with nothing cached. */
  isResolving: boolean;
  /** The live session failed but a cached identity is being trusted. */
  isOffline: boolean;
}

/**
 * Offline-first auth state: once signed in, stays signed in.
 *
 * A cached identity short-circuits the network entirely, so the app opens
 * straight into the tools in a basement. Only an explicit sign-out clears it
 * (see `signOutAndClearScope`).
 */
export function useAuthGate(): AuthGate {
  const { data: session, isPending } = useSession();
  const [cached, setCached] = useState<CachedUser | null>(readCachedUser);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => subscribeCachedUser(setCached), []);

  // The session check has no fetch timeout, so a cold start on a dead
  // connection could keep `isPending` true forever — stranding the entry gate
  // on its spinner instead of reaching sign-in. Resolving as signed-out grants
  // nothing: sign-in needs the network anyway, and a late session answer
  // still signs the user in.
  useEffect(() => {
    if (!isPending || cached !== null) return;
    const timer = setTimeout(() => setTimedOut(true), 8_000);
    return () => clearTimeout(timer);
  }, [isPending, cached]);

  useEffect(() => {
    const live = session?.user;
    if (!live) return;
    const next: CachedUser = { id: live.id, name: live.name, email: live.email };
    if (cached?.id === next.id && cached.name === next.name && cached.email === next.email) return;
    writeCachedUser(next);
    setCached(next);
  }, [session, cached]);

  const liveUser = session?.user
    ? { id: session.user.id, name: session.user.name, email: session.user.email }
    : null;

  return {
    user: liveUser ?? cached,
    isResolving: isPending && cached === null && !timedOut,
    isOffline: liveUser === null && cached !== null,
  };
}
