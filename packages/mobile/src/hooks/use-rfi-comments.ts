import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { rfisApi } from "@/api/rfis";
import type { Db } from "@/db/client";
import { flushOutbox } from "@/db/outbox";
import { rfiCommentsRepository, toComment } from "@/db/rfi-comments-repository";
import { rfisRepository } from "@/db/rfis-repository";

/**
 * Comments from SQLite, refreshed from the RFI detail in the background.
 *
 * Renders local rows first so the thread opens with no signal; a successful
 * fetch upserts and the live query re-runs on its own.
 */
export function useRfiComments(db: Db, projectId: string, rfiId: string) {
  const query = useMemo(() => rfiCommentsRepository.listQuery(db, rfiId), [db, rfiId]);
  const live = useLiveQuery(query);

  useEffect(() => {
    // A queued RFI has no server id yet, so there is nothing to fetch.
    if (rfiId.startsWith("local_")) return;
    let cancelled = false;
    rfisApi
      .detail(projectId, rfiId)
      .then(async (detail) => {
        if (cancelled) return;
        await rfisRepository.upsertFromServer(db, projectId, [detail]);
        await rfiCommentsRepository.upsertFromServer(db, projectId, detail.comments ?? []);
      })
      .catch(() => undefined); // offline: cached rows already rendered
    return () => {
      cancelled = true;
    };
  }, [db, projectId, rfiId]);

  const data = useMemo(() => (live.data ?? []).map(toComment), [live.data]);
  return { data, isPending: live.data === undefined };
}

export function useAddRfiComment(db: Db | null, projectId: string | undefined) {
  return async (rfiId: string, body: string, authorName: string, contentHtml?: string | null) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await rfiCommentsRepository.createLocal(db, projectId, rfiId, body, authorName, contentHtml);
    // The row is already durable, so a failed push just leaves it queued.
    void flushOutbox(db).catch(() => undefined);
  };
}
