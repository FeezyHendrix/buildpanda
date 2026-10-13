import { useProjectBuilding } from "./use-project-building";
import { filterBuildingRows } from "@/lib/building-scope";
import { useSyncState } from "@/lib/sync-provider";
import { useStageScope } from "@/lib/stage-scope";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { dailyLogsApi, type UpsertDailyLogInput } from "@/api/daily-logs";
import type { Db } from "@/db/client";
import { dailyLogsRepository, toDay, toEntry, toLoggedActivity } from "@/db/daily-logs-repository";
import { flushOutbox } from "@/db/outbox";
import type { TemplateField, TemplateResponses } from "@/api/daily-log-templates";
import { cleanResponses, composeEntryBody, missingRequired } from "@/lib/daily-log-template";
import { htmlToText } from "@/lib/html";

/** Recent days from SQLite, refreshed in the background. */
export function useDailyLogDays(db: Db, projectId: string) {
  const { stageId, activityStages } = useStageScope();
  const { buildingId } = useProjectBuilding();
  const { isOnline } = useSyncState();
  const query = useMemo(() => dailyLogsRepository.listQuery(db, projectId, buildingId ?? ""), [db, projectId, buildingId]);
  const live = useLiveQuery(query, [query]);
  const activitiesQuery = useMemo(() => dailyLogsRepository.allActivitiesQuery(db, projectId), [db, projectId]);
  const loggedActivities = useLiveQuery(activitiesQuery, [activitiesQuery]);

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

  const data = useMemo(() => {
    const dates = new Set((loggedActivities.data ?? [])
      .filter((row) => row.projectId === projectId && row.buildingId === buildingId && activityStages.get(row.activityId) === stageId)
      .map((row) => row.logDate));
    return filterBuildingRows((live.data ?? []).filter((row) => row.projectId === projectId), buildingId)
      .map(toDay).filter((row) => !stageId || dates.has(row.logDate));
  }, [live.data, loggedActivities.data, projectId, buildingId, stageId, activityStages]);
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

/** Queues a filled daily log form; it renders now and syncs when there is signal. */
export function useAddTemplateEntry(db: Db | null, projectId: string | undefined) {
  const scope = useProjectBuilding();
  return async (
    logDate: string,
    input: {
      template: { id: string; fields: readonly TemplateField[] };
      responses: TemplateResponses;
      notesHtml?: string | null;
      authorName: string;
      buildingId?: string | null;
    },
  ) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    const buildingId = input.buildingId ?? scope.buildingId;
    if (!buildingId) throw new Error("Choose a building before adding a daily log entry.");
    const responses = cleanResponses(input.template.fields, input.responses);
    const missing = missingRequired(input.template.fields, responses);
    if (missing.length > 0) throw new Error(`Fill in the required fields: ${missing.join(", ")}`);
    const notesText = input.notesHtml ? htmlToText(input.notesHtml) : "";
    const notesHtml = notesText || /<img\b/i.test(input.notesHtml ?? "") ? input.notesHtml ?? null : null;
    if (Object.keys(responses).length === 0 && !notesHtml) throw new Error("Answer at least one question.");
    const body = composeEntryBody(input.template.fields, responses, notesHtml, notesText || null);
    await dailyLogsRepository.addTemplateEntryLocal(db, projectId, logDate, {
      templateId: input.template.id,
      responses: JSON.stringify(responses),
      notesHtml,
      bodyHtml: body.html,
      bodyText: body.text,
      authorName: input.authorName,
      buildingId,
    });
    void flushOutbox(db).catch(() => undefined);
  };
}
