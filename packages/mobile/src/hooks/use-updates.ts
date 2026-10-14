import { projectAccess } from "@/lib/project-access-store";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { updatesApi } from "@/api/updates";
import type { Db } from "@/db/client";
import { flushOutbox, hasPendingCreates } from "@/db/outbox";
import type { ProjectUpdateMediaRow } from "@/db/schema";
import {
  toProjectUpdate,
  UPDATES_RESOURCE,
  updatesRepository,
  type LocalProjectUpdate,
  type LocalUpdateInput,
} from "@/db/updates-repository";
import { effectiveStageId, matchesStage } from "@/lib/stage-filter";
import { useStageScope } from "@/lib/stage-scope";
import { useSyncState } from "@/lib/sync-provider";

function groupByUpdate(rows: readonly ProjectUpdateMediaRow[]): Map<string, ProjectUpdateMediaRow[]> {
  const grouped = new Map<string, ProjectUpdateMediaRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.updateId);
    if (existing) existing.push(row);
    else grouped.set(row.updateId, [row]);
  }
  return grouped;
}

/**
 * Updates straight from SQLite, refreshed in the background.
 *
 * An update written on site is on screen the moment it is saved and survives a
 * restart, because the feed reads the local table rather than the response to a
 * request that cannot be made in a basement.
 *
 * The pull is skipped while a create is still queued: the server would return
 * its own copy under a different id while the `local_` placeholder is still on
 * screen, and the crew member would see the same update twice. Drafts never
 * reach this table — Field Tools is for what has been posted.
 */
export function useProjectUpdates(db: Db, projectId: string, scoped = true) {
  const { isOnline } = useSyncState();
  const { stageId, activityStages } = useStageScope();
  const query = useMemo(() => updatesRepository.listQuery(db, projectId), [db, projectId]);
  const mediaQuery = useMemo(() => updatesRepository.mediaQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query, [query]);
  const liveMedia = useLiveQuery(mediaQuery, [mediaQuery]);

  useEffect(() => {
    if (!isOnline || !projectAccess.can(projectId, "updates", "view")) return;
    let cancelled = false;
    void (async () => {
      if (await hasPendingCreates(db, UPDATES_RESOURCE)) return;
      try {
        const rows = await updatesApi.list(projectId);
        if (cancelled) return;
        await updatesRepository.upsertFromServer(
          db,
          projectId,
          rows.filter((update) => !update.isDraft),
        );
      } catch {
        // Offline: the cached rows are already on screen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, projectId, isOnline]);

  const data = useMemo<LocalProjectUpdate[]>(() => {
    const media = groupByUpdate(liveMedia.data ?? []);
    return (live.data ?? [])
      .map((row) => toProjectUpdate(row, media.get(row.id) ?? []))
      .filter((row) => !scoped || matchesStage(effectiveStageId(row, activityStages), stageId));
  }, [live.data, liveMedia.data, scoped, stageId, activityStages]);

  return { data, isPending: live.updatedAt === undefined && !live.error, error: live.error };
}

export function useProjectUpdate(db: Db, projectId: string, updateId: string) {
  const { data, isPending } = useProjectUpdates(db, projectId, false);
  const update = useMemo(() => data.find((row) => row.id === updateId), [data, updateId]);
  return { update, isPending };
}

export function useCreateProjectUpdate(db: Db | null, projectId: string | undefined) {
  return async (input: LocalUpdateInput) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    const id = await updatesRepository.createLocal(db, projectId, input);
    // The row is already durable, so a failed push just leaves it queued.
    void flushOutbox(db).catch(() => undefined);
    return id;
  };
}
