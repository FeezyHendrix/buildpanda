import { repositoryAccess } from "./permissions";
import { features } from "@/lib/feature-access";
import { randomUUID } from "expo-crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { isWeatherCondition, type DailyLogDay, type UpsertDailyLogInput } from "@/api/daily-logs";
import type { Db } from "./client";
import { localIsoDate } from "@/lib/dates";
import { reviveOrQueue } from "./enqueue-update";
import { isOutboxItemSending } from "./sync-write-state";
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
const access = repositoryAccess(features.dailyLog);

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
  allActivitiesQuery: (db: Db, projectId: string) =>
    db.select().from(dailyLogActivities).where(access.where(db, dailyLogActivities.projectId, eq(dailyLogActivities.projectId, projectId))),
  activitiesQuery: (db: Db, projectId: string, logDate: string, buildingId?: string) =>
    db
      .select()
      .from(dailyLogActivities)
      .where(
        access.where(db, dailyLogActivities.projectId, eq(dailyLogActivities.projectId, projectId), eq(dailyLogActivities.logDate, logDate), buildingId !== undefined ? eq(dailyLogActivities.buildingId, buildingId) : undefined),
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
    access.require(db, projectId, "create");
    if (input.delayReasonCode) repositoryAccess(features.schedule).require(db, projectId, "edit");
    const id = `${projectId}:${logDate}:${input.activityId}`;
    await access.transaction(db, projectId, "create", (tx) => {
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
      .where(access.where(db, dailyLogs.projectId, eq(dailyLogs.projectId, projectId), buildingId !== undefined ? eq(dailyLogs.buildingId, buildingId) : undefined))
      .orderBy(desc(dailyLogs.logDate)),

  dayQuery: (db: Db, projectId: string, logDate: string, buildingId: string) =>
    db
      .select()
      .from(dailyLogs)
      .where(access.where(db, dailyLogs.projectId, eq(dailyLogs.id, dayKey(projectId, logDate, buildingId))))
      .limit(1),

  entriesQuery: (db: Db, projectId: string, logDate: string, buildingId: string) =>
    db
      .select()
      .from(dailyLogEntries)
      .where(access.where(db, dailyLogEntries.projectId, eq(dailyLogEntries.projectId, projectId), eq(dailyLogEntries.logDate, logDate), eq(dailyLogEntries.buildingId, buildingId)))
      .orderBy(asc(dailyLogEntries.createdAt)),

  /**
   * Drops a note the author has not uploaded yet, with its queued push.
   *
   * Only an unsent note can go: once the server holds it, removing the local
   * row would hide a record the project still has. A note whose push is
   * already in flight is refused rather than half-deleted — the upload would
   * land with nothing left on the device to reconcile against.
   */
  async removeEntryLocal(db: Db, projectId: string, entryId: string): Promise<void> {
    access.require(db, projectId, "create");
    const [row] = await db
      .select()
      .from(dailyLogEntries)
      .where(access.where(db, dailyLogEntries.projectId, eq(dailyLogEntries.id, entryId)))
      .limit(1);
    if (!row) return;
    if (!row.isPendingSync) throw new Error("This note is already uploaded, so it can't be removed here.");
    const queued = await db
      .select()
      .from(outbox)
      .where(and(eq(outbox.resource, "daily-log-entries"), eq(outbox.entityId, entryId)));
    if (queued.some((item) => isOutboxItemSending(item.id))) {
      throw new Error("This note is uploading right now. Try removing it once the sync finishes.");
    }
    await access.transaction(db, projectId, "create", (tx) => {
      tx.delete(dailyLogEntries).where(access.where(db, dailyLogEntries.projectId, eq(dailyLogEntries.id, entryId))).run();
      tx.delete(outbox).where(and(eq(outbox.resource, "daily-log-entries"), eq(outbox.entityId, entryId))).run();
    });
  },

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
    access.require(db, projectId, "create");
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

    await access.transaction(db, projectId, "create", (tx) => {
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
    access.require(db, projectId, "create");
    const id = `local_${randomUUID()}`;
    await access.transaction(db, projectId, "create", (tx) => {
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
   * A filled template form. The answers and notes travel to the server
   * separately (it re-validates and renders them); the rendered body is kept
   * here so the day reads the same before sync, and so the entry can still go
   * up as plain text if the form was archived while the crew was offline.
   */
  async addTemplateEntryLocal(
    db: Db,
    projectId: string,
    logDate: string,
    entry: {
      templateId: string;
      responses: string;
      notesHtml: string | null;
      bodyHtml: string;
      bodyText: string;
      authorName: string;
      buildingId: string;
    },
  ): Promise<void> {
    const id = `local_${randomUUID()}`;
    await access.transaction(db, projectId, "create", (tx) => {
      tx.insert(dailyLogEntries).values({
        id,
        projectId,
        logDate,
        authorName: entry.authorName,
        bodyText: entry.bodyText,
        bodyHtml: entry.bodyHtml,
        buildingId: entry.buildingId,
        templateId: entry.templateId,
        responses: entry.responses,
        notesHtml: entry.notesHtml,
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
    access.require(db, projectId);
    if (days.length === 0) return;
    const now = Date.now();
    await access.transaction(db, projectId, "read", (tx) => {
      for (const day of days) {
        // An empty response for a date is not a saved log. Keep local drafts.
        if (day.recorded === false) {
          tx.delete(dailyLogs).where(and(eq(dailyLogs.id, dayKey(projectId, day.logDate, day.buildingId)), eq(dailyLogs.isPendingSync, false))).run();
          continue;
        }
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
