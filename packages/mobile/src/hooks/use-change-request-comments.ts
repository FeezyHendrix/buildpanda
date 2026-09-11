import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { changeRequestsApi } from "@/api/change-requests";
import type { Db } from "@/db/client";
import {
  changeRequestCommentsRepository,
  toChangeRequestComment,
} from "@/db/change-request-comments-repository";
import { changeRequestsRepository } from "@/db/change-requests-repository";
import { flushOutbox } from "@/db/outbox";

/**
 * Comments from SQLite, refreshed from the change request detail in the
 * background.
 *
 * Renders local rows first so the thread opens with no signal; a successful
 * fetch upserts (never over a pending row) and the live query re-runs on its own.
 */
export function useChangeRequestComments(db: Db, projectId: string, changeRequestId: string) {
  const query = useMemo(
    () => changeRequestCommentsRepository.listQuery(db, changeRequestId),
    [db, changeRequestId],
  );
  const live = useLiveQuery(query);

  useEffect(() => {
    // A queued request has no server id yet, so there is nothing to fetch.
    if (changeRequestId.startsWith("local_")) return;
    let cancelled = false;
    changeRequestsApi
      .detail(projectId, changeRequestId)
      .then(async (detail) => {
        if (cancelled) return;
        await changeRequestsRepository.upsertFromServer(db, projectId, [detail]);
        await changeRequestCommentsRepository.upsertFromServer(
          db,
          changeRequestId,
          projectId,
          detail.comments ?? [],
        );
      })
      .catch(() => undefined); // offline: cached rows already rendered
    return () => {
      cancelled = true;
    };
  }, [db, projectId, changeRequestId]);

  const data = useMemo(() => (live.data ?? []).map(toChangeRequestComment), [live.data]);
  return { data, isPending: live.data === undefined };
}

export function useAddChangeRequestComment(db: Db | null, projectId: string | undefined) {
  return async (changeRequestId: string, body: string, authorName: string) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await changeRequestCommentsRepository.addLocal(db, changeRequestId, projectId, body, authorName);
    // The row is already durable, so a failed push just leaves it queued.
    void flushOutbox(db).catch(() => undefined);
  };
}
