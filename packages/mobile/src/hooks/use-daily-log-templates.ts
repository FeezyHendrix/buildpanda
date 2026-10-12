import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { dailyLogTemplatesApi } from "@/api/daily-log-templates";
import type { Db } from "@/db/client";
import { dailyLogTemplatesRepository, toTemplate } from "@/db/daily-log-templates-repository";
import { useSyncState } from "@/lib/sync-provider";

/**
 * The project's daily log forms from SQLite, refreshed from the web when there
 * is signal. Admins build them on the web; the field app only fills them.
 */
export function useDailyLogTemplates(db: Db, projectId: string) {
  const { isOnline } = useSyncState();
  const query = useMemo(() => dailyLogTemplatesRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query, [query]);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    dailyLogTemplatesApi
      .list(projectId)
      .then((templates) => {
        if (!cancelled) return dailyLogTemplatesRepository.replaceFromServer(db, projectId, templates);
      })
      .catch(() => undefined); // offline or no access: the cached forms still work
    return () => {
      cancelled = true;
    };
  }, [db, projectId, isOnline]);

  const data = useMemo(
    () => (live.data ?? []).filter((row) => row.projectId === projectId).map(toTemplate),
    [live.data, projectId],
  );
  return { data, isPending: live.updatedAt === undefined && !live.error };
}
