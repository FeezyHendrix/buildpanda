import { useSyncState } from "@/lib/sync-provider";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { changeRequestsApi, type UpsertChangeRequestInput } from "@/api/change-requests";
import type { Db } from "@/db/client";
import { flushOutbox } from "@/db/outbox";
import { changeRequestsRepository, toChangeRequest } from "@/db/change-requests-repository";

/** SQLite first, background refresh — opens with no signal. */
export function useLocalChangeRequests(db: Db, projectId: string) {
  const { isOnline } = useSyncState();
  const query = useMemo(() => changeRequestsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query, [query]);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    changeRequestsApi
      .list(projectId)
      .then((rows) => {
        if (!cancelled) return changeRequestsRepository.upsertFromServer(db, projectId, rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [db, projectId, isOnline]);

  const data = useMemo(() => (live.data ?? []).map(toChangeRequest), [live.data]);
  return { data, isPending: live.updatedAt === undefined && !live.error, error: live.error };
}

/** One change request from SQLite; `null` once the query has run and found nothing. */
export function useLocalChangeRequest(db: Db, id: string) {
  const query = useMemo(() => changeRequestsRepository.byIdQuery(db, id), [db, id]);
  const live = useLiveQuery(query, [query]);
  const row = live.data?.[0];
  const data = useMemo(() => (row ? toChangeRequest(row) : null), [row]);
  return { data, isPending: live.updatedAt === undefined && !live.error, error: live.error };
}

export function useCreateChangeRequest(db: Db | null, projectId: string | undefined) {
  return async (input: UpsertChangeRequestInput) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await changeRequestsRepository.createLocal(db, projectId, input);
    void flushOutbox(db).catch(() => undefined);
  };
}

export function useUpdateChangeRequest(db: Db | null, projectId: string | undefined) {
  return async (id: string, patch: Partial<UpsertChangeRequestInput>) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await changeRequestsRepository.updateLocal(db, projectId, id, patch);
    void flushOutbox(db).catch(() => undefined);
  };
}

export function useDeleteChangeRequest(db: Db | null, projectId: string | undefined) {
  return async (id: string) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await changeRequestsRepository.deleteLocal(db, projectId, id);
    void flushOutbox(db).catch(() => undefined);
  };
}
