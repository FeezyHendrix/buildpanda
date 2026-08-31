import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { dailyLogsApi, type UpsertDailyLogInput } from "@/api/daily-logs";
import type { Db } from "@/db/client";
import { dailyLogsRepository, toDay, toEntry } from "@/db/daily-logs-repository";
import { flushOutbox } from "@/db/outbox";

/** Recent days from SQLite, refreshed in the background. */
export function useDailyLogDays(db: Db, projectId: string) {
  const query = useMemo(() => dailyLogsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);

  useEffect(() => {
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
  }, [db, projectId]);

  const data = useMemo(() => (live.data ?? []).map(toDay), [live.data]);
  return { data, isPending: live.data === undefined };
}

export function useDailyLogDay(db: Db, projectId: string, logDate: string) {
  const dayQuery = useMemo(
    () => dailyLogsRepository.dayQuery(db, projectId, logDate),
    [db, projectId, logDate],
  );
  const entriesQuery = useMemo(
    () => dailyLogsRepository.entriesQuery(db, projectId, logDate),
    [db, projectId, logDate],
  );

  const liveDay = useLiveQuery(dayQuery);
  const liveEntries = useLiveQuery(entriesQuery);

  useEffect(() => {
    let cancelled = false;
    dailyLogsApi
      .day(projectId, logDate)
      .then((day) => {
        if (!cancelled) return dailyLogsRepository.upsertFromServer(db, projectId, [day]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [db, projectId, logDate]);

  const day = useMemo(() => (liveDay.data?.[0] ? toDay(liveDay.data[0]) : null), [liveDay.data]);
  const entries = useMemo(() => (liveEntries.data ?? []).map(toEntry), [liveEntries.data]);

  return { day, entries, isPending: liveDay.data === undefined };
}

export function useSaveDailyLog(db: Db | null, projectId: string | undefined) {
  return async (logDate: string, input: UpsertDailyLogInput) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await dailyLogsRepository.upsertLocal(db, projectId, logDate, input);
    void flushOutbox(db).catch(() => undefined);
  };
}

export function useAddDailyLogEntry(db: Db | null, projectId: string | undefined) {
  return async (logDate: string, bodyText: string, authorName: string, bodyHtml?: string | null) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await dailyLogsRepository.addEntryLocal(db, projectId, logDate, bodyText, authorName, bodyHtml);
    void flushOutbox(db).catch(() => undefined);
  };
}
