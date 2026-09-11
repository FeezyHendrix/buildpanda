import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { lookAheadsApi, type CreateLookAheadInput } from "@/api/look-aheads";
import type { Db } from "@/db/client";
import { flushOutbox } from "@/db/outbox";
import { lookAheadsRepository, toLookAhead, type LookAheadPatch } from "@/db/look-aheads-repository";

/** SQLite first, background refresh — opens with no signal. */
export function useLocalLookAheads(db: Db, projectId: string) {
  const query = useMemo(() => lookAheadsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);

  useEffect(() => {
    let cancelled = false;
    lookAheadsApi
      .list(projectId)
      .then((rows) => {
        if (!cancelled) return lookAheadsRepository.upsertFromServer(db, projectId, rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [db, projectId]);

  const data = useMemo(() => (live.data ?? []).map(toLookAhead), [live.data]);
  return { data, isPending: live.data === undefined };
}

/** One look-ahead from SQLite; `null` once the query has run and found nothing. */
export function useLocalLookAhead(db: Db, id: string) {
  const query = useMemo(() => lookAheadsRepository.byIdQuery(db, id), [db, id]);
  const live = useLiveQuery(query);
  const row = live.data?.[0];
  const data = useMemo(() => (row ? toLookAhead(row) : null), [row]);
  return { data, isPending: live.data === undefined };
}

export function useCreateLookAhead(db: Db | null, projectId: string | undefined) {
  return async (input: CreateLookAheadInput) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await lookAheadsRepository.createLocal(db, projectId, input);
    void flushOutbox(db).catch(() => undefined);
  };
}

export function useUpdateLookAhead(db: Db | null, projectId: string | undefined) {
  return async (lookAheadId: string, patch: LookAheadPatch) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await lookAheadsRepository.updateLocal(db, projectId, lookAheadId, patch);
    void flushOutbox(db).catch(() => undefined);
  };
}

export function useDeleteLookAhead(db: Db | null, projectId: string | undefined) {
  return async (id: string) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await lookAheadsRepository.deleteLocal(db, projectId, id);
    void flushOutbox(db).catch(() => undefined);
  };
}
