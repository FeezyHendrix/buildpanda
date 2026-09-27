import type { Knex } from "knex";
import type { FastifyBaseLogger } from "fastify";
import type { QueueManager } from "../../lib/queue/index.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { dailyDigestRepository } from "./daily-digest-repository.ts";
import { dailyDigestService, isoDate } from "./daily-digest.ts";

export const DAILY_DIGEST_QUEUE = "daily-update-digest-sweep";

const HOUR_MS = 60 * 60 * 1_000;
const DIGEST_HOUR_UTC = 18;
const DAILY_CADENCES = ["daily", "both"] as const;

export interface DailyDigestJobData {
  _tick: number;
}

export interface DailyDigestSweepResult {
  candidates: number;
  drafted: number;
  skippedQuiet: number;
  skippedExisting: number;
  errored: number;
}

const IDLE: DailyDigestSweepResult = {
  candidates: 0,
  drafted: 0,
  skippedQuiet: 0,
  skippedExisting: 0,
  errored: 0,
};

/**
 * The sweep ticks hourly and only drafts once the working day is over, rather
 * than every 24h from process start — an interval-from-boot schedule drifts,
 * and for a *daily* digest the firing time is what decides which day gets
 * summarised. Re-running within the same day is harmless: the draft lookup is
 * keyed on the day, so a project can only ever get one.
 */
export async function runDailyDigestSweep(
  db: Knex,
  logger: FastifyBaseLogger,
  queue?: QueueManager,
  now: Date = new Date(),
): Promise<DailyDigestSweepResult> {
  if (now.getUTCHours() < DIGEST_HOUR_UTC) return { ...IDLE };

  const digests = dailyDigestService(db);
  const repository = dailyDigestRepository(db);
  const notifications = notificationsService(notificationsRepository(db), queue);
  const digestDate = isoDate(now);

  const projects = await repository.candidateProjects(DAILY_CADENCES);
  const organizationIds = [
    ...new Set(projects.flatMap((p) => (p.organization_id ? [p.organization_id] : []))),
  ];
  const adminRows = await repository.orgAdmins(organizationIds);

  const adminsByOrg = new Map<string, string[]>();
  for (const row of adminRows) {
    const list = adminsByOrg.get(row.organizationId) ?? [];
    list.push(row.userId);
    adminsByOrg.set(row.organizationId, list);
  }

  const result: DailyDigestSweepResult = { ...IDLE, candidates: projects.length };

  for (const project of projects) {
    try {
      const outcome = await digests.generateIfActive({
        projectId: project.id,
        digestDate,
      });

      if (outcome.status === "quiet") {
        result.skippedQuiet += 1;
        continue;
      }
      if (outcome.status === "existing") {
        result.skippedExisting += 1;
        continue;
      }
      result.drafted += 1;

      const recipients = new Set<string>();
      if (project.owner_id) recipients.add(project.owner_id);
      for (const userId of adminsByOrg.get(project.organization_id ?? "") ?? []) {
        recipients.add(userId);
      }
      for (const userId of recipients) {
        await notifications.notify(userId, "update_draft_ready", {
          title: "Today's site digest is ready to review",
          body: `Panda AI summarised everything logged on ${project.name} today. Review it from the Updates page.`,
          projectId: project.id,
        });
      }
    } catch (error) {
      result.errored += 1;
      logger.error(
        { err: error, projectId: project.id, queue: DAILY_DIGEST_QUEUE },
        "daily digest generation failed",
      );
    }
  }

  return result;
}

export function registerDailyDigestWorker(
  db: Knex,
  manager: QueueManager,
  logger: FastifyBaseLogger,
): void {
  manager.startRepeating<DailyDigestJobData>(
    DAILY_DIGEST_QUEUE,
    HOUR_MS,
    async () => {
      const summary = await runDailyDigestSweep(db, logger, manager);
      logger.info({ queue: DAILY_DIGEST_QUEUE, ...summary }, "daily digest sweep complete");
    },
    { _tick: 0 },
  );
}
