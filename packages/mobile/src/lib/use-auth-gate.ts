import { useEffect, useState } from "react";
import { useSession } from "./auth-client";
import { readCachedUser, writeCachedUser, type CachedUser } from "./session-cache";

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
    isResolving: isPending && cached === null,
    isOffline: liveUser === null && cached !== null,
  };
}
