import { and, asc, eq, lte } from "drizzle-orm";
import { activitiesApi } from "@/api/activities";
import { changeRequestsApi } from "@/api/change-requests";
import { dailyLogsApi } from "@/api/daily-logs";
import { lookAheadsApi } from "@/api/look-aheads";
import { materialsApi } from "@/api/materials";
import { changeRequestsRepository } from "./change-requests-repository";
import { lookAheadsRepository } from "./look-aheads-repository";
import { materialsRepository } from "./materials-repository";
import { rfisApi } from "@/api/rfis";
import { rfiCommentsRepository } from "./rfi-comments-repository";
import type { Db } from "./client";
import { dailyLogActivities, dailyLogEntries, dailyLogs, outbox, rfiComments, rfis } from "./schema";
import { rfisRepository } from "./rfis-repository";
import { textToParagraphHtml } from "@/lib/html";

const MAX_ATTEMPTS = 8;

/**
 * Only one flush may run at a time.
 *
 * Foreground, reconnect and the interval can all fire together; without this
 * two flushes read the same pending rows and POST the same RFI twice, which
 * the server has no way to reject because it has no idempotency key yet.
 */
let inFlight: Promise<FlushResult> | null = null;

/** Exponential backoff with jitter, capped at 30 minutes. */
function nextDelayMs(attempts: number): number {
  const base = Math.min(15_000 * 2 ** attempts, 30 * 60_000);
  return base * (0.8 + Math.random() * 0.4);
}

/**
 * A transport failure means "try later"; a 4xx means the payload will never be
 * accepted, so it fails fast and surfaces instead of retrying forever.
 */
function isPermanent(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 401 && status !== 429;
}

function isAuthFailure(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 401;
}

export interface FlushResult {
  pushed: number;
  failed: number;
  pausedForAuth: boolean;
}

/**
 * Drains the queue oldest-first. Payloads are rebuilt from the current local
 * row at send time rather than replayed from a frozen body.
 */
export function flushOutbox(db: Db): Promise<FlushResult> {
  if (inFlight) return inFlight;
  inFlight = runFlush(db).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runFlush(db: Db): Promise<FlushResult> {
  const now = Date.now();
  const due = await db
    .select()
    .from(outbox)
    .where(and(eq(outbox.status, "pending"), lte(outbox.nextAttemptAt, now)))
    .orderBy(asc(outbox.createdAt));

  let pushed = 0;
  let failed = 0;

  for (const item of due) {
    try {
      if (item.resource === "change-requests") {
        // Before the row lookup: deleteLocal already removed it, so a missing
        // row is expected here rather than a reason to drop the push.
        if (item.operation === "delete") {
          await changeRequestsApi.remove(item.projectId, item.entityId);
          await db.delete(outbox).where(eq(outbox.id, item.id));
          pushed += 1;
          continue;
        }
        const row = await changeRequestsRepository.findById(db, item.entityId);
        if (!row) {
          await db.delete(outbox).where(eq(outbox.id, item.id));
          continue;
        }
        if (item.operation === "update") {
          await changeRequestsApi.update(item.projectId, row.id, {
            title: row.title,
            description: row.description,
            descriptionHtml: row.descriptionHtml,
            reason: row.reason,
            costImpact: row.costImpact,
            timeImpactDays: row.timeImpactDays,
          });
          await changeRequestsRepository.markSynced(db, row.id);
          await db.delete(outbox).where(eq(outbox.id, item.id));
          pushed += 1;
          continue;
        }
        const server = await changeRequestsApi.create(item.projectId, {
          title: row.title,
          description: row.description,
          descriptionHtml: row.descriptionHtml,
          reason: row.reason,
          costImpact: row.costImpact,
          timeImpactDays: row.timeImpactDays,
        });
        await changeRequestsRepository.reconcileCreate(db, item.projectId, row.id, server);
        await db.delete(outbox).where(eq(outbox.id, item.id));
        pushed += 1;
        continue;
      }

      if (item.resource === "look-aheads") {
        // Before the row lookup: deleteLocal already removed it, so a missing
        // row is expected here rather than a reason to drop the push.
        if (item.operation === "delete") {
          await lookAheadsApi.remove(item.projectId, item.entityId);
          await db.delete(outbox).where(eq(outbox.id, item.id));
          pushed += 1;
          continue;
        }
        const row = await lookAheadsRepository.findById(db, item.entityId);
        if (!row) {
          await db.delete(outbox).where(eq(outbox.id, item.id));
          continue;
        }
        if (item.operation === "update") {
          // buildingId travels with the patch: the API refuses a look-ahead
          // write without one on a multi-building project.
          await lookAheadsApi.update(item.projectId, row.id, {
            name: row.name,
            description: row.description,
            startDate: row.startDate,
            endDate: row.endDate,
            totalWorkers: row.totalWorkers,
            ...(row.buildingId ? { buildingId: row.buildingId } : {}),
          });
          await lookAheadsRepository.markSynced(db, row.id);
          await db.delete(outbox).where(eq(outbox.id, item.id));
          pushed += 1;
          continue;
        }
        const server = await lookAheadsApi.create(item.projectId, {
          name: row.name,
          description: row.description,
          startDate: row.startDate,
          endDate: row.endDate,
          totalWorkers: row.totalWorkers,
        });
        await lookAheadsRepository.reconcileCreate(db, item.projectId, row.id, server);
        await db.delete(outbox).where(eq(outbox.id, item.id));
        pushed += 1;
        continue;
      }

      if (item.resource === "material-orders") {
        // Before the row lookup: deleteLocal already removed it, so a missing
        // row is expected here rather than a reason to drop the push.
        if (item.operation === "delete") {
          await materialsApi.remove(item.projectId, item.entityId);
          await db.delete(outbox).where(eq(outbox.id, item.id));
          pushed += 1;
          continue;
        }
        const row = await materialsRepository.findById(db, item.entityId);
        if (!row) {
          await db.delete(outbox).where(eq(outbox.id, item.id));
          continue;
        }
        if (item.operation === "update") {
            await materialsApi.update(item.projectId, row.id, {
              title: row.title,
              materialName: row.materialName,
              quantity: row.quantity,
              unit: row.unit,
              supplier: row.supplier,
              phaseId: row.phaseId,
            });
          await materialsRepository.markSynced(db, row.id);
          await db.delete(outbox).where(eq(outbox.id, item.id));
          pushed += 1;
          continue;
        }
          const server = await materialsApi.create(item.projectId, {
            title: row.title,
            materialName: row.materialName,
            quantity: row.quantity,
            unit: row.unit,
            supplier: row.supplier,
            phaseId: row.phaseId,
          });
        await materialsRepository.reconcileCreate(db, item.projectId, row.id, server);
        await db.delete(outbox).where(eq(outbox.id, item.id));
        pushed += 1;
        continue;
      }

      if (item.resource === "daily-logs") {
        const [day] = await db
          .select()
          .from(dailyLogs)
          .where(eq(dailyLogs.id, item.entityId))
          .limit(1);
        if (!day) {
          await db.delete(outbox).where(eq(outbox.id, item.id));
          continue;
        }

        await dailyLogsApi.upsert(item.projectId, day.logDate, {
          totalHours: day.totalHours,
          summary: day.summary,
          buildingId: day.buildingId,
        });
        await db
          .update(dailyLogs)
          .set({ isPendingSync: false, serverLastSyncedAt: Date.now() })
          .where(eq(dailyLogs.id, day.id));
        await db.delete(outbox).where(eq(outbox.id, item.id));
        pushed += 1;
        continue;
      }

      if (item.resource === "daily-log-activities") {
        const [logged] = await db
          .select()
          .from(dailyLogActivities)
          .where(eq(dailyLogActivities.id, item.entityId))
          .limit(1);
        if (!logged) {
          await db.delete(outbox).where(eq(outbox.id, item.id));
          continue;
        }

        await dailyLogsApi.linkActivity(
          item.projectId,
          logged.logDate,
          logged.activityId,
          logged.hoursLogged,
        );

        // A blocked activity also raises a delay, reusing the shared reason
        // codes rather than burying "why" in free text.
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
        pushed += 1;
        continue;
      }

      if (item.resource === "daily-log-entries") {
        const [entry] = await db
          .select()
          .from(dailyLogEntries)
          .where(eq(dailyLogEntries.id, item.entityId))
          .limit(1);
        if (!entry) {
          await db.delete(outbox).where(eq(outbox.id, item.id));
          continue;
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
        pushed += 1;
        continue;
      }

      if (item.resource === "rfi-comments") {
        const [comment] = await db
          .select()
          .from(rfiComments)
          .where(eq(rfiComments.id, item.entityId))
          .limit(1);
        if (!comment) {
          await db.delete(outbox).where(eq(outbox.id, item.id));
          continue;
        }
        // A comment on an RFI that is itself still queued has to wait: the
        // server has no id for that RFI yet.
        if (comment.rfiId.startsWith("local_")) continue;

        const server = await rfisApi.addComment(item.projectId, comment.rfiId, comment.body, comment.contentHtml);
        await rfiCommentsRepository.reconcileCreate(db, comment.id, server);
        await db.delete(outbox).where(eq(outbox.id, item.id));
        pushed += 1;
        continue;
      }

      const [row] = await db.select().from(rfis).where(eq(rfis.id, item.entityId)).limit(1);
      if (!row) {
        await db.delete(outbox).where(eq(outbox.id, item.id));
        continue;
      }

      if (item.operation === "create") {
        const server = await rfisApi.create(item.projectId, {
          subject: row.subject,
          question: row.question,
          questionHtml: row.questionHtml,
          priority: row.priority as never,
          dueDate: row.dueDate,
          costImpact: row.costImpact,
          scheduleImpact: row.scheduleImpact,
        });
        await rfisRepository.reconcileCreate(db, item.projectId, row.id, server);
      } else {
        await rfisApi.update(item.projectId, row.id, {
          subject: row.subject,
          question: row.question,
          questionHtml: row.questionHtml,
          priority: row.priority as never,
        });
        await db
          .update(rfis)
          .set({ isPendingSync: false, serverLastSyncedAt: Date.now() })
          .where(eq(rfis.id, row.id));
      }

      await db.delete(outbox).where(eq(outbox.id, item.id));
      pushed += 1;
    } catch (error) {
      if (isAuthFailure(error)) {
        // Session expired: the queue is still valid intent, so pause the whole
        // flush rather than burning an attempt on every item.
        return { pushed, failed, pausedForAuth: true };
      }

      const attempts = item.attempts + 1;
      const permanent = isPermanent(error) || attempts >= MAX_ATTEMPTS;
      await db
        .update(outbox)
        .set({
          attempts,
          status: permanent ? "failed" : "pending",
          nextAttemptAt: permanent ? 0 : Date.now() + nextDelayMs(attempts),
          lastError: error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(outbox.id, item.id));
      failed += 1;
    }
  }

  return { pushed, failed, pausedForAuth: false };
}

export async function pendingCount(db: Db): Promise<number> {
  const rows = await db.select({ id: outbox.id }).from(outbox).where(eq(outbox.status, "pending"));
  return rows.length;
}

/** Live queue state for the header indicator. */
export const outboxQuery = (db: Db) => db.select().from(outbox);

/**
 * True while a resource has creates the server hasn't accepted yet.
 *
 * A pull during that window inserts the server's copy under its own id while
 * the local placeholder still exists, so the crew member sees the same RFI
 * twice. Skipping the pull until the queue drains avoids it — the proper fix is
 * client-generated ids the server accepts, which needs a backend change.
 */
export async function hasPendingCreates(db: Db, resource: string): Promise<boolean> {
  const rows = await db
    .select({ id: outbox.id })
    .from(outbox)
    .where(and(eq(outbox.resource, resource), eq(outbox.operation, "create")))
    .limit(1);
  return rows.length > 0;
}
