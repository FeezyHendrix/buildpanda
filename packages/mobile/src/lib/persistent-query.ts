import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { queryStorage } from "./query-storage";
import type { AccessRequirement } from "./access-requirement";
import { useProjectAccess } from "./project-access-provider";
import { projectAccess, requireAccess, requireCurrentAccess } from "./project-access-store";
import { useFieldSession } from "./field-session";

/**
 * A read that survives going offline.
 *
 * Protected cache reads require a current scoped access snapshot. Identity and
 * workspace are part of every key, including the in-memory query cache.
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
  refetchInterval?: number | false;
  /** Null is reserved for online workspace/project discovery before scope selection. */
  permission: AccessRequirement | null;
  persist?: boolean;
  projectId?: string;
}

export type PersistentQueryResult<T> = UseQueryResult<T> & { isStale: boolean };

export function usePersistentQuery<T>({
  queryKey,
  ownerId,
  queryFn,
  enabled = true,
  refetchInterval = false,
  permission,
  persist = true,
  projectId,
}: PersistentQueryOptions<T>): PersistentQueryResult<T> {
  const access = useProjectAccess();
  const { organizationId } = useFieldSession();
  const permitted = !permission || (projectId === access.scope?.projectId && access.allows(permission));
  const active = enabled && Boolean(ownerId) && permitted;
  const scopedKey = [...queryKey, { organizationId: organizationId ?? null }];
  const key = cacheKey(ownerId, scopedKey);
  const seeded = useMemo(() => active && persist ? readCache<T>(ownerId, scopedKey) : undefined, [key, active, persist, access.generation]);

  const query = useQuery({
    // Keep feature prefixes intact so existing invalidations still match.
    queryKey: [...scopedKey, { ownerId: ownerId ?? null, access: permission ? access.generation : null }],
    queryFn: async () => {
      if (permission) requireAccess(projectId!, permission);
      const ticket = projectAccess.getState();
      const data = await queryFn();
      if (permission) requireCurrentAccess(ticket);
      if (persist) writeCache(ownerId, scopedKey, data);
      return data;
    },
    enabled: active,
    initialData: seeded,
    initialDataUpdatedAt: 0,
    networkMode: "always",
    retry: 1,
    refetchInterval,
    refetchIntervalInBackground: false,
  });

  return { ...query, data: active ? query.data : undefined, isPending: active && query.isPending, isStale: active && query.isError && query.data !== undefined } as PersistentQueryResult<T>;
}
