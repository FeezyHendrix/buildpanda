import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import type { Db } from "./client";
import { dayKey } from "./daily-logs-repository";
import { reviveOrQueue } from "./enqueue-update";
import { dailyLogs, dailyLogEntries, outbox } from "./schema";
import { isRecordSending } from "./sync-write-state";

/** Older app versions could queue logs without a building. Never guess their destination. */
export const unassignedLogsRepository = {
  daysQuery: (db: Db, projectId: string) => db.select().from(dailyLogs).where(
    and(eq(dailyLogs.projectId, projectId), isNull(dailyLogs.buildingId), eq(dailyLogs.isPendingSync, true)),
  ),
  entriesQuery: (db: Db, projectId: string) => db.select().from(dailyLogEntries).where(
    and(eq(dailyLogEntries.projectId, projectId), isNull(dailyLogEntries.buildingId), eq(dailyLogEntries.isPendingSync, true)),
  ),
  async assign(db: Db, projectId: string, date: string, buildingId: string) {
    await db.transaction((tx) => {
      const oldId = dayKey(projectId, date);
      const id = dayKey(projectId, date, buildingId);
      const day = tx.select().from(dailyLogs).where(and(eq(dailyLogs.id, oldId), isNull(dailyLogs.buildingId), eq(dailyLogs.isPendingSync, true))).get();
      if (day) {
        if (isRecordSending(tx, "daily-logs", oldId)) throw new Error("This log is syncing. Try again when sync finishes.");
        if (tx.select().from(dailyLogs).where(eq(dailyLogs.id, id)).get()) {
          throw new Error("This building already has a log for that day. Review the older log before merging it.");
        }
        tx.update(dailyLogs).set({ id, buildingId, updatedAt: Date.now() }).where(eq(dailyLogs.id, oldId)).run();
        tx.update(outbox).set({ entityId: id }).where(and(eq(outbox.resource, "daily-logs"), eq(outbox.entityId, oldId))).run();
        reviveOrQueue(tx, { resource: "daily-logs", projectId, entityId: id, operation: "upsert", newId: randomUUID() });
      }
      const entries = tx.select().from(dailyLogEntries).where(and(eq(dailyLogEntries.projectId, projectId), eq(dailyLogEntries.logDate, date), isNull(dailyLogEntries.buildingId), eq(dailyLogEntries.isPendingSync, true))).all();
      for (const entry of entries) {
        if (isRecordSending(tx, "daily-log-entries", entry.id)) throw new Error("An entry is syncing. Try again when sync finishes.");
        tx.update(dailyLogEntries).set({ buildingId }).where(eq(dailyLogEntries.id, entry.id)).run();
        reviveOrQueue(tx, { resource: "daily-log-entries", projectId, entityId: entry.id, operation: "create", newId: randomUUID() });
      }
    });
  },
};
