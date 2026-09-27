import { useProjectBuilding } from "./use-project-building";
import { filterBuildingRows } from "@/lib/building-scope";
import { useSyncState } from "@/lib/sync-provider";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { dailyLogsApi, type UpsertDailyLogInput } from "@/api/daily-logs";
import type { Db } from "@/db/client";
import { dailyLogsRepository, toDay, toEntry, toLoggedActivity } from "@/db/daily-logs-repository";
import { flushOutbox } from "@/db/outbox";

/** Recent days from SQLite, refreshed in the background. */
export function useDailyLogDays(db: Db, projectId: string) {
  const { buildingId } = useProjectBuilding();
  const { isOnline } = useSyncState();
  const query = useMemo(() => dailyLogsRepository.listQuery(db, projectId, buildingId ?? ""), [db, projectId, buildingId]);
  const live = useLiveQuery(query, [query]);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    dailyLogsApi
      .list(projectId)
      .then((days) => {
        if (!cancelled) return dailyLogsRepository.upsertFromServer(db, projectId, days);
      })
      .catch(() => undefined); // offline: cached days already rendered
    return () => {
      cancelled = true;
    };
  }, [db, projectId, isOnline]);

  const data = useMemo(() => filterBuildingRows((live.data ?? []).filter((r) => r.projectId === projectId), buildingId).map(toDay), [live.data, projectId, buildingId]);
  return { data, isPending: live.updatedAt === undefined && !live.error, error: live.error };
}

export function useDailyLogDay(db: Db, projectId: string, logDate: string, buildingId: string) {
  const { isOnline } = useSyncState();
  const dayQuery = useMemo(
    () => dailyLogsRepository.dayQuery(db, projectId, logDate, buildingId),
    [db, projectId, logDate, buildingId],
  );
  const entriesQuery = useMemo(
    () => dailyLogsRepository.entriesQuery(db, projectId, logDate, buildingId),
    [db, projectId, logDate, buildingId],
  );

  const activitiesQuery = useMemo(() => dailyLogsRepository.activitiesQuery(db, projectId, logDate, buildingId), [db, projectId, logDate, buildingId]);
  const liveActivities = useLiveQuery(activitiesQuery, [activitiesQuery]);
  const activities = (liveActivities.data ?? []).filter((r) => r.projectId === projectId && r.buildingId === buildingId && r.logDate === logDate).map(toLoggedActivity);

  const liveDay = useLiveQuery(dayQuery, [dayQuery]);
  const liveEntries = useLiveQuery(entriesQuery, [entriesQuery]);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    dailyLogsApi
      .day(projectId, logDate, buildingId)
      .then((day) => {
        if (!cancelled) return dailyLogsRepository.upsertFromServer(db, projectId, [day]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [db, projectId, logDate, buildingId, isOnline]);

  const day = useMemo(() => (liveDay.data?.[0]?.buildingId === buildingId && liveDay.data[0].logDate === logDate && liveDay.data[0].projectId === projectId ? toDay(liveDay.data[0]) : null), [liveDay.data, buildingId, logDate, projectId]);
  const entries = useMemo(() => (liveEntries.data ?? []).filter((r) => r.buildingId === buildingId && r.logDate === logDate && r.projectId === projectId).map(toEntry), [liveEntries.data, buildingId, logDate, projectId]);

  return { day, entries, activities, isPending: (liveDay.updatedAt === undefined || liveEntries.updatedAt === undefined) && !liveDay.error && !liveEntries.error, error: liveDay.error ?? liveEntries.error };
}

export function useSaveDailyLog(db: Db | null, projectId: string | undefined) {
  const scope = useProjectBuilding();
  return async (logDate: string, input: UpsertDailyLogInput) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    const buildingId = input.buildingId ?? scope.buildingId;
    if (!buildingId) throw new Error("Choose a building before saving a daily log.");
    await dailyLogsRepository.upsertLocal(db, projectId, logDate, { ...input, buildingId });
    void flushOutbox(db).catch(() => undefined);
  };
}

export function useAddDailyLogEntry(db: Db | null, projectId: string | undefined) {
  const scope = useProjectBuilding();
  return async (
    logDate: string,
    bodyText: string,
    authorName: string,
    bodyHtml?: string | null,
    buildingId?: string | null,
  ) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    const resolvedId = buildingId ?? scope.buildingId;
    if (!resolvedId) throw new Error("Choose a building before adding a daily log entry.");
    await dailyLogsRepository.addEntryLocal(
      db,
      projectId,
      logDate,
      bodyText,
      authorName,
      bodyHtml,
      resolvedId,
    );
    void flushOutbox(db).catch(() => undefined);
  };
}
