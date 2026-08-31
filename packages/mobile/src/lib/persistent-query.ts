import { useMemo, useRef } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { storage } from "./storage";

/**
 * A read that survives going offline.
 *
 * Only the sign-in screen may require connectivity. Everything past it renders
 * from the last good response, because a crew member opens this app in a
 * basement. Entries are namespaced by user id so two people sharing a site
 * tablet never read each other's rows.
 */
const PREFIX = "buildpanda_cache";

function cacheKey(ownerId: string | undefined, queryKey: readonly unknown[]): string {
  return `${PREFIX}_${ownerId ?? "anon"}_${JSON.stringify(queryKey)}`;
}

function readCache<T>(ownerId: string | undefined, queryKey: readonly unknown[]): T | undefined {
  try {
    const raw = storage.getItem(cacheKey(ownerId, queryKey));
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache<T>(ownerId: string | undefined, queryKey: readonly unknown[], value: T): void {
  try {
    storage.setItem(cacheKey(ownerId, queryKey), JSON.stringify(value));
  } catch {
    // Storage unavailable — the query still works while the app is open.
  }
}

interface PersistentQueryOptions<T> {
  /** From the key factory, so mutations can invalidate the same key. */
  queryKey: readonly unknown[];
  ownerId: string | undefined;
  queryFn: () => Promise<T>;
  enabled?: boolean;
}

export type PersistentQueryResult<T> = UseQueryResult<T> & { isStale: boolean };

export function usePersistentQuery<T>({
  queryKey,
  ownerId,
  queryFn,
  enabled = true,
}: PersistentQueryOptions<T>): PersistentQueryResult<T> {
  // Read the cache once per mount, not once per render — this is a synchronous
  // native keychain call, and it used to run on every render of every screen.
  const seededRef = useRef<{ value: T | undefined } | null>(null);
  if (seededRef.current === null) {
    seededRef.current = { value: readCache<T>(ownerId, queryKey) };
  }
  const seeded = seededRef.current.value;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const data = await queryFn();
      writeCache(ownerId, queryKey, data);
      return data;
    },
    enabled,
    initialData: seeded,
    retry: 1,
  });

  // Memoised so the returned object keeps a stable identity between renders;
  // spreading the query result inline made every consumer re-render.
  return useMemo(
    () => Object.assign(query, { isStale: query.isError && seeded !== undefined }),
    [query, seeded],
  ) as PersistentQueryResult<T>;
}
