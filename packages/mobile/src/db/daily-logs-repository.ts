import { randomUUID } from "expo-crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import type { DailyLogDay, UpsertDailyLogInput } from "@/api/daily-logs";
import type { Db } from "./client";
import {
  dailyLogActivities,
  dailyLogEntries,
  dailyLogs,
  outbox,
  type DailyLogActivityRow,
  type DailyLogEntryRow,
  type DailyLogRow,
} from "./schema";

/** Composite key, because a daily log is identified by project + date. */
export function dayKey(projectId: string, logDate: string): string {
  return `${projectId}:${logDate}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toDay(row: DailyLogRow) {
  return {
    id: row.id,
    logDate: row.logDate,
    totalHours: row.totalHours,
    summary: row.summary,
    isVoided: Boolean(row.voidedAt),
    isPendingSync: row.isPendingSync,
  };
}

export function toEntry(row: DailyLogEntryRow) {
  return {
    id: row.id,
    authorName: row.authorName,
    bodyText: row.bodyText,
    voided: row.voided,
    createdAt: row.createdAt,
    isPendingSync: row.isPendingSync,
  };
}

export function toLoggedActivity(row: DailyLogActivityRow) {
  return {
    id: row.id,
    activityId: row.activityId,
    activityName: row.activityName,
    hoursLogged: row.hoursLogged,
    delayReasonCode: row.delayReasonCode,
    delayNote: row.delayNote,
    isPendingSync: row.isPendingSync,
  };
}

export const dailyLogsRepository = {
  activitiesQuery: (db: Db, projectId: string, logDate: string) =>
    db
      .select()
      .from(dailyLogActivities)
      .where(
        and(
          eq(dailyLogActivities.projectId, projectId),
          eq(dailyLogActivities.logDate, logDate),
        ),
      ),

  /** Logs work against an activity and queues the push. */
  async logActivityLocal(
    db: Db,
    projectId: string,
    logDate: string,
    input: {
      activityId: string;
      activityName: string;
      hoursLogged: number;
      delayReasonCode?: string | null;
      delayNote?: string | null;
    },
  ): Promise<void> {
    const id = `${projectId}:${logDate}:${input.activityId}`;
    await db.transaction(async (tx) => {
      await tx
        .insert(dailyLogActivities)
        .values({
          id,
          projectId,
          logDate,
          activityId: input.activityId,
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
        });

      // One queued push per activity per day, so editing hours repeatedly
      // offline still results in a single POST.
      const [queued] = await tx
        .select({ id: outbox.id })
        .from(outbox)
        .where(and(eq(outbox.resource, "daily-log-activities"), eq(outbox.entityId, id)))
        .limit(1);
      if (!queued) {
        await tx.insert(outbox).values({
          id: randomUUID(),
          resource: "daily-log-activities",
          entityId: id,
          projectId,
          operation: "create",
          nextAttemptAt: 0,
        });
      }
    });
  },

  listQuery: (db: Db, projectId: string) =>
    db
      .select()
      .from(dailyLogs)
      .where(eq(dailyLogs.projectId, projectId))
      .orderBy(desc(dailyLogs.logDate)),

  dayQuery: (db: Db, projectId: string, logDate: string) =>
    db
      .select()
      .from(dailyLogs)
      .where(and(eq(dailyLogs.projectId, projectId), eq(dailyLogs.logDate, logDate)))
      .limit(1),

  entriesQuery: (db: Db, projectId: string, logDate: string) =>
    db
      .select()
      .from(dailyLogEntries)
      .where(and(eq(dailyLogEntries.projectId, projectId), eq(dailyLogEntries.logDate, logDate)))
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
    const id = dayKey(projectId, logDate);
    const now = Date.now();

    await db.transaction(async (tx) => {
      await tx
        .insert(dailyLogs)
        .values({
          id,
          projectId,
          logDate,
          totalHours: input.totalHours ?? 0,
          summary: input.summary ?? null,
          isPendingSync: true,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: dailyLogs.id,
          set: {
            totalHours: input.totalHours ?? 0,
            summary: input.summary ?? null,
            isPendingSync: true,
            updatedAt: now,
          },
        });

      const [queued] = await tx
        .select({ id: outbox.id })
        .from(outbox)
        .where(and(eq(outbox.resource, "daily-logs"), eq(outbox.entityId, id)))
        .limit(1);

      if (!queued) {
        await tx.insert(outbox).values({
          id: randomUUID(),
          resource: "daily-logs",
          entityId: id,
          projectId,
          operation: "upsert",
          nextAttemptAt: 0,
        });
      }
    });
  },

  async addEntryLocal(
    db: Db,
    projectId: string,
    logDate: string,
    bodyText: string,
    authorName: string,
  ): Promise<void> {
    const id = `local_${randomUUID()}`;
    await db.transaction(async (tx) => {
      await tx.insert(dailyLogEntries).values({
        id,
        projectId,
        logDate,
        authorName,
        bodyText,
        createdAt: Date.now(),
        isPendingSync: true,
      });
      await tx.insert(outbox).values({
        id: randomUUID(),
        resource: "daily-log-entries",
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      });
    });
  },

  /** Server days never clobber a day still holding local edits. */
  async upsertFromServer(db: Db, projectId: string, days: readonly DailyLogDay[]): Promise<void> {
    if (days.length === 0) return;
    const now = Date.now();
    await db.transaction(async (tx) => {
      for (const day of days) {
        await tx
          .insert(dailyLogs)
          .values({
            id: dayKey(projectId, day.logDate),
            projectId,
            logDate: day.logDate,
            totalHours: day.totalHours,
            voidedAt: day.voidedAt ?? null,
            isPendingSync: false,
            serverLastSyncedAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: dailyLogs.id,
            set: {
              totalHours: day.totalHours,
              voidedAt: day.voidedAt ?? null,
              serverLastSyncedAt: now,
              updatedAt: now,
            },
            where: eq(dailyLogs.isPendingSync, false),
          });

        for (const entry of day.entries ?? []) {
          await tx
            .insert(dailyLogEntries)
            .values({
              id: entry.id,
              projectId,
              logDate: day.logDate,
              authorName: entry.authorName,
              bodyText: entry.bodyText ?? "",
              voided: entry.voided,
              createdAt: Date.parse(entry.createdAt) || now,
              isPendingSync: false,
            })
            .onConflictDoUpdate({
              target: dailyLogEntries.id,
              set: { bodyText: entry.bodyText ?? "", voided: entry.voided },
              where: eq(dailyLogEntries.isPendingSync, false),
            });
        }
      }
    });
  },
};
