import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { transactionalNotifications } from "../notifications/transactional.ts";
import { tasksRepository } from "./repository.ts";
import { tasksService } from "./service.ts";
import { taskVisibilityRepository } from "./visibility-repository.ts";
import { taskVisibilityService } from "./visibility-service.ts";

export function buildTasksServices(db: Knex, queue?: Pick<QueueManager, "enqueue">) {
  const buildings = buildingsRepository(db);
  const notifications = transactionalNotifications(db, queue);
  const service = tasksService(tasksRepository(db), { notifications: notifications.service }, async (projectId) =>
    (await buildings.soleRealBuildingId(projectId)) ?? (await buildings.firstRealBuildingId(projectId)));
  const visibility = taskVisibilityService(taskVisibilityRepository(db));
  return { service, visibility, flush: notifications.flush };
}
