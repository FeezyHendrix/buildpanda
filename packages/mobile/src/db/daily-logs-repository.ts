import { randomUUID } from "expo-crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { isWeatherCondition, type DailyLogDay, type UpsertDailyLogInput } from "@/api/daily-logs";
import type { Db } from "./client";
import { localIsoDate } from "@/lib/dates";
import { reviveOrQueue } from "./enqueue-update";
import {
  dailyLogActivities,
  dailyLogEntries,
  dailyLogs,
  outbox,
  type DailyLogActivityRow,
  type DailyLogEntryRow,
  type DailyLogRow,
} from "./schema";

/** Composite key, because a daily log is identified by project + building + date. */
export function dayKey(projectId: string, logDate: string, buildingId?: string | null): string {
  return buildingId ? `${projectId}:${buildingId}:${logDate}` : `${projectId}:${logDate}`;
}

export function todayIso(): string {
  return localIsoDate();
}

export function toDay(row: DailyLogRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    buildingId: row.buildingId,
    logDate: row.logDate,
    weatherCondition: isWeatherCondition(row.weatherCondition) ? row.weatherCondition : null,
    temperatureC: row.temperatureC,
    workersExpected: row.workersExpected,
    workersPresent: row.workersPresent,
    totalHours: row.totalHours,
    summary: row.summary,
    isVoided: Boolean(row.voidedAt),
    isPendingSync: row.isPendingSync,
  };
}

export function toEntry(row: DailyLogEntryRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    buildingId: row.buildingId,
    authorName: row.authorName,
    bodyText: row.bodyText,
    bodyHtml: row.bodyHtml,
    voided: row.voided,
    createdAt: row.createdAt,
    isPendingSync: row.isPendingSync,
  };
}

export function toLoggedActivity(row: DailyLogActivityRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    buildingId: row.buildingId,
    activityId: row.activityId,
    activityName: row.activityName,
    hoursLogged: row.hoursLogged,
    delayReasonCode: row.delayReasonCode,
    delayNote: row.delayNote,
    isPendingSync: row.isPendingSync,
  };
}

export const dailyLogsRepository = {
  activitiesQuery: (db: Db, projectId: string, logDate: string, buildingId?: string) =>
    db
      .select()
      .from(dailyLogActivities)
      .where(
        and(
          eq(dailyLogActivities.projectId, projectId),
          eq(dailyLogActivities.logDate, logDate),
          buildingId !== undefined ? eq(dailyLogActivities.buildingId, buildingId) : undefined,
        ),
      ),

  /** Logs work against an activity and queues the push. */
  async logActivityLocal(
    db: Db,
    projectId: string,
    logDate: string,
    input: {
      buildingId?: string | null;
      activityId: string;
      activityName: string;
      hoursLogged: number;
      delayReasonCode?: string | null;
      delayNote?: string | null;
    },
  ): Promise<void> {
    const id = `${projectId}:${logDate}:${input.activityId}`;
    await db.transaction((tx) => {
      tx
        .insert(dailyLogActivities)
        .values({
          id,
          projectId,
          logDate,
          activityId: input.activityId,
          buildingId: input.buildingId ?? null,
          activityName: input.activityName,
          hoursLogged: input.hoursLogged,
          delayReasonCode: input.delayReasonCode ?? null,
          delayNote: input.delayNote ?? null,
          isPendingSync: true,
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: dailyLogActivities.id,
          set: {
            hoursLogged: input.hoursLogged,
            delayReasonCode: input.delayReasonCode ?? null,
            delayNote: input.delayNote ?? null,
            isPendingSync: true,
            updatedAt: Date.now(),
          },
        }).run();

      // One queued push per activity per day, so editing hours repeatedly
      // offline still results in a single POST.
      reviveOrQueue(tx, {
        resource: "daily-log-activities",
        entityId: id,
        projectId,
        operation: "create",
        newId: randomUUID(),
      });
    });
  },

  listQuery: (db: Db, projectId: string, buildingId?: string) =>
    db
      .select()
      .from(dailyLogs)
      .where(and(eq(dailyLogs.projectId, projectId), buildingId !== undefined ? eq(dailyLogs.buildingId, buildingId) : undefined))
      .orderBy(desc(dailyLogs.logDate)),

  dayQuery: (db: Db, projectId: string, logDate: string, buildingId: string) =>
    db
      .select()
      .from(dailyLogs)
      .where(eq(dailyLogs.id, dayKey(projectId, logDate, buildingId)))
      .limit(1),

  entriesQuery: (db: Db, projectId: string, logDate: string, buildingId: string) =>
    db
      .select()
      .from(dailyLogEntries)
      .where(and(eq(dailyLogEntries.projectId, projectId), eq(dailyLogEntries.logDate, logDate), eq(dailyLogEntries.buildingId, buildingId)))
      .orderBy(asc(dailyLogEntries.createdAt)),

  /**
   * Upserts the day locally and queues one push per day.
   *
   * The outbox is keyed on the day, so editing the same log five times offline
   * still results in a single PUT rather than five conflicting ones.
   */
  async upsertLocal(
    db: Db,
    projectId: string,
    logDate: string,
    input: UpsertDailyLogInput,
  ): Promise<void> {
    const id = dayKey(projectId, logDate, input.buildingId);
    const now = Date.now();
    // Forms send every field; voice actions may send only hours. Omitted
    // values preserve existing data, while explicit null still clears a field.
    const fields = {
      weatherCondition: input.weatherCondition ?? null,
      temperatureC: input.temperatureC ?? null,
      workersExpected: input.workersExpected ?? 0,
      workersPresent: input.workersPresent ?? 0,
      totalHours: input.totalHours ?? 0,
      summary: input.summary ?? null,
    };

    await db.transaction((tx) => {
      tx
        .insert(dailyLogs)
        .values({
          id,
          projectId,
          logDate,
          ...fields,
          buildingId: input.buildingId ?? null,
          isPendingSync: true,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: dailyLogs.id,
          set: {
            ...(input.weatherCondition !== undefined ? { weatherCondition: input.weatherCondition } : {}),
            ...(input.temperatureC !== undefined ? { temperatureC: input.temperatureC } : {}),
            ...(input.workersExpected !== undefined ? { workersExpected: input.workersExpected } : {}),
            ...(input.workersPresent !== undefined ? { workersPresent: input.workersPresent } : {}),
            ...(input.totalHours !== undefined ? { totalHours: input.totalHours } : {}),
            ...(input.summary !== undefined ? { summary: input.summary } : {}),
            ...(input.buildingId !== undefined ? { buildingId: input.buildingId } : {}),
            isPendingSync: true,
            updatedAt: now,
          },
        }).run();

      reviveOrQueue(tx, {
        resource: "daily-logs",
        entityId: id,
        projectId,
        operation: "upsert",
        newId: randomUUID(),
      });
    });
  },

  async addEntryLocal(
    db: Db,
    projectId: string,
    logDate: string,
    bodyText: string,
    authorName: string,
    bodyHtml?: string | null,
    buildingId?: string | null,
  ): Promise<void> {
    const id = `local_${randomUUID()}`;
    await db.transaction((tx) => {
      tx.insert(dailyLogEntries).values({
        id,
        projectId,
        logDate,
        authorName,
        bodyText,
        bodyHtml: bodyHtml ?? null,
        buildingId: buildingId ?? null,
        createdAt: Date.now(),
        isPendingSync: true,
      }).run();
      tx.insert(outbox).values({
        id: randomUUID(),
        resource: "daily-log-entries",
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      }).run();
    });
  },

  /**
   * Server days never clobber a building's day still holding local edits.
   */
  async upsertFromServer(db: Db, projectId: string, days: readonly DailyLogDay[]): Promise<void> {
    if (days.length === 0) return;
    const now = Date.now();
    await db.transaction((tx) => {
      for (const day of days) {
        tx
          .insert(dailyLogs)
          .values({
            id: dayKey(projectId, day.logDate, day.buildingId),
            buildingId: day.buildingId ?? null,
            summary: day.summary ?? null,
            projectId,
            logDate: day.logDate,
            weatherCondition: day.weatherCondition ?? null,
            temperatureC: day.temperatureC ?? null,
            workersExpected: day.workersExpected ?? 0,
            workersPresent: day.workersPresent ?? 0,
            totalHours: day.totalHours,
            voidedAt: day.voidedAt ?? null,
            isPendingSync: false,
            serverLastSyncedAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: dailyLogs.id,
            set: {
              ...(day.summary !== undefined ? { summary: day.summary } : {}),
              weatherCondition: day.weatherCondition ?? null,
              temperatureC: day.temperatureC ?? null,
              workersExpected: day.workersExpected ?? 0,
              workersPresent: day.workersPresent ?? 0,
              totalHours: day.totalHours,
              voidedAt: day.voidedAt ?? null,
              serverLastSyncedAt: now,
              updatedAt: now,
            },
            where: eq(dailyLogs.isPendingSync, false),
          }).run();

        for (const activity of day.activities ?? []) {
          const values = {
            id: `${projectId}:${day.logDate}:${activity.activityId}`,
            projectId, buildingId: day.buildingId ?? null, logDate: day.logDate,
            activityId: activity.activityId, activityName: activity.activityName,
            hoursLogged: activity.hoursLogged, updatedAt: now,
          };
          tx.insert(dailyLogActivities).values(values).onConflictDoUpdate({
            target: dailyLogActivities.id,
            set: values,
            where: eq(dailyLogActivities.isPendingSync, false),
          }).run();
        }

        for (const entry of day.entries ?? []) {
          tx
            .insert(dailyLogEntries)
            .values({
              id: entry.id,
              buildingId: entry.buildingId ?? day.buildingId ?? null,
              projectId,
              logDate: day.logDate,
              authorName: entry.authorName,
              bodyText: entry.bodyText ?? "",
              bodyHtml: entry.bodyHtml,
              voided: entry.voided,
              createdAt: Date.parse(entry.createdAt) || now,
              isPendingSync: false,
            })
            .onConflictDoUpdate({
              target: dailyLogEntries.id,
              set: { buildingId: entry.buildingId ?? day.buildingId ?? null, bodyText: entry.bodyText ?? "", bodyHtml: entry.bodyHtml, voided: entry.voided },
              where: eq(dailyLogEntries.isPendingSync, false),
            }).run();
        }
      }
    });
  },
};
