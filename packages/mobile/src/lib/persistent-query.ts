import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { queryStorage } from "./query-storage";

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
    const raw = queryStorage.getItem(cacheKey(ownerId, queryKey));
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache<T>(ownerId: string | undefined, queryKey: readonly unknown[], value: T): void {
  try {
    queryStorage.setItem(cacheKey(ownerId, queryKey), JSON.stringify(value));
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
  const key = cacheKey(ownerId, queryKey);
  const seeded = useMemo(() => readCache<T>(ownerId, queryKey), [key]);

  const query = useQuery({
    // Keep feature prefixes intact so existing invalidations still match.
    queryKey: [...queryKey, { ownerId: ownerId ?? null }],
    queryFn: async () => {
      const data = await queryFn();
      writeCache(ownerId, queryKey, data);
      return data;
    },
    enabled: enabled && Boolean(ownerId),
    initialData: seeded,
    initialDataUpdatedAt: 0,
    networkMode: "always",
    retry: 1,
  });

  return { ...query, isStale: query.isError && query.data !== undefined } as PersistentQueryResult<T>;
}
