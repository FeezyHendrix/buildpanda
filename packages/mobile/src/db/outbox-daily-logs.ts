import { eq } from "drizzle-orm";
import { activitiesApi } from "@/api/activities";
import { dailyLogsApi, isWeatherCondition } from "@/api/daily-logs";
import { textToParagraphHtml } from "@/lib/html";
import type { Db } from "./client";
import { done, skipped, type OutboxHandlerResult } from "./outbox-handler";
import { dailyLogActivities, dailyLogEntries, dailyLogs, outbox, type OutboxRow } from "./schema";

export async function pushDailyLogOutboxItem(
  db: Db,
  item: OutboxRow,
): Promise<OutboxHandlerResult> {
  if (item.resource === "daily-logs") return pushDailyLog(db, item);
  if (item.resource === "daily-log-activities") return pushDailyLogActivity(db, item);
  if (item.resource === "daily-log-entries") return pushDailyLogEntry(db, item);
  return skipped;
}

async function pushDailyLog(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  const [day] = await db.select().from(dailyLogs).where(eq(dailyLogs.id, item.entityId)).limit(1);
  if (!day) {
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(false);
  }

  await dailyLogsApi.upsert(item.projectId, day.logDate, {
    weatherCondition: isWeatherCondition(day.weatherCondition) ? day.weatherCondition : null,
    temperatureC: day.temperatureC,
    workersExpected: day.workersExpected,
    workersPresent: day.workersPresent,
    totalHours: day.totalHours,
    summary: day.summary,
    buildingId: day.buildingId,
  });
  await db
    .update(dailyLogs)
    .set({ isPendingSync: false, serverLastSyncedAt: Date.now() })
    .where(eq(dailyLogs.id, day.id));
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}

async function pushDailyLogActivity(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  const [logged] = await db
    .select()
    .from(dailyLogActivities)
    .where(eq(dailyLogActivities.id, item.entityId))
    .limit(1);
  if (!logged) {
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(false);
  }

  await dailyLogsApi.linkActivity(item.projectId, logged.logDate, logged.activityId, logged.hoursLogged);
  if (logged.delayReasonCode) {
    await activitiesApi.raiseDelay(item.projectId, logged.activityId, {
      reasonCode: logged.delayReasonCode,
      description: logged.delayNote ?? undefined,
      startedAt: new Date(`${logged.logDate}T09:00:00`).toISOString(),
    });
  }

  await db
    .update(dailyLogActivities)
    .set({ isPendingSync: false })
    .where(eq(dailyLogActivities.id, logged.id));
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}

async function pushDailyLogEntry(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  const [entry] = await db
    .select()
    .from(dailyLogEntries)
    .where(eq(dailyLogEntries.id, item.entityId))
    .limit(1);
  if (!entry) {
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(false);
  }

  const server = await dailyLogsApi.addEntry(
    item.projectId,
    entry.logDate,
    entry.bodyHtml ?? textToParagraphHtml(entry.bodyText),
    entry.bodyText,
    entry.buildingId,
  );
  await db.transaction(async (tx) => {
    await tx.delete(dailyLogEntries).where(eq(dailyLogEntries.id, entry.id));
    await tx.insert(dailyLogEntries).values({
      id: server.id,
      projectId: item.projectId,
      logDate: entry.logDate,
      authorName: server.authorName,
      bodyText: server.bodyText ?? entry.bodyText,
      bodyHtml: server.bodyHtml ?? entry.bodyHtml,
      buildingId: entry.buildingId,
      voided: server.voided,
      createdAt: Date.parse(server.createdAt) || Date.now(),
      isPendingSync: false,
    });
  });
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}
