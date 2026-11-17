import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { buildingsService } from "../buildings/service.ts";
import { updatesRepository } from "../updates/repository.ts";
import { updatesService } from "../updates/service.ts";
import { activitiesRepository } from "../activities/repository.ts";
import { activitiesService } from "../activities/service.ts";
import { dailyLogTemplatesRepository } from "../daily-log-templates/repository.ts";
import { dailyLogTemplatesService } from "../daily-log-templates/service.ts";
import { dailyLogsRepository } from "./repository.ts";
import { dailyLogsService } from "./service.ts";
import { PROGRESS_RECOMPUTE_QUEUE, runProgressRecompute } from "../activities/progress-job.ts";
import { materialLedgerNotificationQueue } from "../materials-ledger/notification-queue.ts";

export function buildDailyLogsService(db: Knex, originalQueue?: Pick<QueueManager, "enqueue">) {
  const queue = materialLedgerNotificationQueue(db, originalQueue);
  const buildings = buildingsRepository(db);
  const updates = updatesService(updatesRepository(db));
  const activitiesRepo = activitiesRepository(db);
  const activities = activitiesService(activitiesRepo, (projectId) =>
    queue ? queue.enqueue(PROGRESS_RECOMPUTE_QUEUE, "recompute", { projectId }) : runProgressRecompute(db, { projectId }),
    (projectId) => buildings.soleRealBuildingId(projectId),
  );
  const templates = dailyLogTemplatesService(dailyLogTemplatesRepository(db));
  const service = dailyLogsService(dailyLogsRepository(db), {
    assertBuilding: buildingsService(buildings).assertRealBuilding,
    createUpdate: (projectId, input, actor) => updates.create(projectId, input, actor),
    fillTemplate: (projectId, templateId, responses) => templates.fill(projectId, templateId, responses),
    markActivityInProgress: async (projectId, activityId) => {
      const current = await activitiesRepo.findById(activityId).catch(() => undefined);
      if (current && current.status === "Planned") {
        await activities
          .update(projectId, activityId, { status: "InProgress" })
          .catch(() => undefined);
      }
    },
  }, (projectId) => buildings.soleRealBuildingId(projectId));

  return service;
}
