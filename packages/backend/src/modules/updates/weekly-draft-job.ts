import type { Knex } from "knex";
import type { FastifyBaseLogger } from "fastify";
import type { QueueManager } from "../../lib/queue/index.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { aiDraftService } from "./ai-draft.ts";

export const WEEKLY_UPDATE_DRAFT_QUEUE = "weekly-update-draft-sweep";

const INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000;
const ACTIVITY_WINDOW_DAYS = 7;

export interface WeeklyUpdateDraftJobData {
  _tick: number;
}

interface CandidateProjectRow {
  id: string;
  name: string;
  owner_id: string | null;
  organization_id: string | null;
}

interface OrgAdminRow {
  organizationId: string;
  userId: string;
}

export interface WeeklyUpdateDraftSweepResult {
  candidates: number;
  drafted: number;
  skippedExisting: number;
  errored: number;
}

export async function runWeeklyUpdateDraftSweep(
  db: Knex,
  logger: FastifyBaseLogger,
  queue?: QueueManager,
): Promise<WeeklyUpdateDraftSweepResult> {
  const drafts = aiDraftService(db);
  const notifications = notificationsService(notificationsRepository(db), queue);
  const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 86_400_000);
  const sinceDate = since.toISOString().slice(0, 10);

  // Only projects with any activity in the window get a draft — zero-activity
  // projects are skipped entirely so nobody is spammed with empty updates.
  // Projects that turned the preference off never get an automatic draft.
  const projects = await db<CandidateProjectRow>("projects as p")
    .whereIn("p.ai_update_cadence", ["weekly", "both"])
    .where((builder) =>
      builder
        .whereExists(
          db("daily_logs")
            .whereRaw("daily_logs.project_id = p.id")
            .where("log_date", ">=", sinceDate),
        )
        .orWhereExists(
          db("project_updates")
            .whereRaw("project_updates.project_id = p.id")
            .where("is_draft", false)
            .where("created_at", ">=", since),
        )
        .orWhereExists(
          db("activities")
            .whereRaw("activities.project_id = p.id")
            .where("updated_at", ">=", since),
        ),
    )
    .select("p.id", "p.name", "p.owner_id", "p.organization_id");

  const orgIds = [...new Set(projects.flatMap((p) => (p.organization_id ? [p.organization_id] : [])))];
  const adminRows = orgIds.length
    ? await db<OrgAdminRow>("member")
        .whereIn("organizationId", orgIds)
        .whereIn("role", ["owner", "admin"])
        .select("organizationId", "userId")
    : [];
  const adminsByOrg = new Map<string, string[]>();
  for (const row of adminRows) {
    const list = adminsByOrg.get(row.organizationId) ?? [];
    list.push(row.userId);
    adminsByOrg.set(row.organizationId, list);
  }

  const result: WeeklyUpdateDraftSweepResult = {
    candidates: projects.length,
    drafted: 0,
    skippedExisting: 0,
    errored: 0,
  };

  for (const project of projects) {
    try {
      const draft = await drafts.generateClientUpdateDraft({
        projectId: project.id,
        requestedBy: null,
      });
      if (!draft.created) {
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
          title: "Your weekly client update draft is ready to review",
          body: `Panda AI drafted a weekly homeowner update for ${project.name}. Review and publish it from the Updates page.`,
          projectId: project.id,
        });
      }
    } catch (error) {
      result.errored += 1;
      logger.error(
        { err: error, projectId: project.id, queue: WEEKLY_UPDATE_DRAFT_QUEUE },
        "weekly update draft generation failed",
      );
    }
  }

  return result;
}

export function registerWeeklyUpdateDraftWorker(
  db: Knex,
  manager: QueueManager,
  logger: FastifyBaseLogger,
): void {
  manager.startRepeating<WeeklyUpdateDraftJobData>(
    WEEKLY_UPDATE_DRAFT_QUEUE,
    INTERVAL_MS,
    async () => {
      const summary = await runWeeklyUpdateDraftSweep(db, logger, manager);
      logger.info(
        { queue: WEEKLY_UPDATE_DRAFT_QUEUE, ...summary },
        "weekly update draft sweep complete",
      );
    },
    { _tick: 0 },
  );
}
