import { settleOutboxItem } from "./sync-write-state";
import { eq } from "drizzle-orm";
import { activitiesApi } from "@/api/activities";
import { dailyLogsApi } from "@/api/daily-logs";
import { isWeatherCondition } from "@/lib/daily-log-weather";
import { ApiError } from "@/api/client";
import type { TemplateResponses } from "@/api/daily-log-templates";
import { htmlToText, textToParagraphHtml } from "@/lib/html";
import type { Db } from "./client";
import { done, skipped, type OutboxHandlerResult, dropItem, finishItem } from "./outbox-handler";
import { dailyLogActivities, dailyLogEntries, dailyLogs, type DailyLogEntryRow, type OutboxRow } from "./schema";

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
  if (!day) return dropItem(db, item);

  await dailyLogsApi.upsert(item.projectId, day.logDate, {
    weatherCondition: isWeatherCondition(day.weatherCondition) ? day.weatherCondition : null,
    temperatureC: day.temperatureC,
    workersExpected: day.workersExpected,
    workersPresent: day.workersPresent,
    totalHours: day.totalHours,
    summary: day.summary,
    buildingId: day.buildingId,
  });
  settleOutboxItem(db, item);
  return done(true);
}

async function pushDailyLogActivity(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  const [logged] = await db
    .select()
    .from(dailyLogActivities)
    .where(eq(dailyLogActivities.id, item.entityId))
    .limit(1);
  if (!logged) return dropItem(db, item);

  await dailyLogsApi.linkActivity(item.projectId, logged.logDate, logged.activityId, logged.hoursLogged);
  if (logged.delayReasonCode) {
    await activitiesApi.raiseDelay(item.projectId, logged.activityId, {
      reasonCode: logged.delayReasonCode,
      description: logged.delayNote ?? undefined,
      startedAt: new Date(`${logged.logDate}T09:00:00`).toISOString(),
    });
  }

  settleOutboxItem(db, item);
  return done(true);
}

/**
 * A form filled offline can meet a template that changed meanwhile: archived,
 * or given a new required question. The crew's answers are still the record of
 * the day, so on a validation refusal the entry goes up as the text they saw.
 */
async function pushTemplateEntry(projectId: string, entry: DailyLogEntryRow) {
  try {
    return await dailyLogsApi.addTemplateEntry(projectId, entry.logDate, {
      templateId: entry.templateId!,
      responses: parseResponses(entry.responses),
      bodyHtml: entry.notesHtml,
      bodyText: entry.notesHtml ? htmlToText(entry.notesHtml) || null : null,
      buildingId: entry.buildingId,
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 0;
    if (status !== 400 && status !== 404 && status !== 422) throw error;
    return dailyLogsApi.addEntry(
      projectId,
      entry.logDate,
      entry.bodyHtml ?? textToParagraphHtml(entry.bodyText),
      entry.bodyText,
      entry.buildingId,
    );
  }
}

function parseResponses(json: string | null): TemplateResponses {
  try {
    const parsed: unknown = JSON.parse(json ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as TemplateResponses) : {};
  } catch {
    return {};
  }
}

async function pushDailyLogEntry(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  const [entry] = await db
    .select()
    .from(dailyLogEntries)
    .where(eq(dailyLogEntries.id, item.entityId))
    .limit(1);
  if (!entry) return dropItem(db, item);

  const server = entry.templateId
    ? await pushTemplateEntry(item.projectId, entry)
    : await dailyLogsApi.addEntry(
        item.projectId,
        entry.logDate,
        entry.bodyHtml ?? textToParagraphHtml(entry.bodyText),
        entry.bodyText,
        entry.buildingId,
      );
  await db.transaction((tx) => {
    tx.delete(dailyLogEntries).where(eq(dailyLogEntries.id, entry.id)).run();
    tx.insert(dailyLogEntries).values({
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
    }).run();
  });
  return finishItem(db, item);
}
