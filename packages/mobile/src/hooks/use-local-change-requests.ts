import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { changeRequestsApi, type UpsertChangeRequestInput } from "@/api/change-requests";
import type { Db } from "@/db/client";
import { flushOutbox } from "@/db/outbox";
import { changeRequestsRepository, toChangeRequest } from "@/db/change-requests-repository";

/** SQLite first, background refresh — opens with no signal. */
export function useLocalChangeRequests(db: Db, projectId: string) {
  const query = useMemo(() => changeRequestsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);

  useEffect(() => {
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
  }, [db, projectId]);

  const data = useMemo(() => (live.data ?? []).map(toChangeRequest), [live.data]);
  return { data, isPending: live.data === undefined };
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
