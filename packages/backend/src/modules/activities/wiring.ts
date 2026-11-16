import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { transactionalNotifications } from "../notifications/transactional.ts";
import { BadRequestError } from "../../lib/errors.ts";
import { toCalendar } from "../../lib/working-days.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { keyDatesRepository } from "../key-dates/repository.ts";
import { keyDatesService } from "../key-dates/service.ts";
import { activitiesRepository } from "./repository.ts";
import { activitiesService } from "./service.ts";
import { delaysService } from "./delays.ts";
import { runProgressRecompute } from "./progress-job.ts";

export function buildActivityServices(db: Knex, queue?: Pick<QueueManager, "enqueue">) {
  const notifications = transactionalNotifications(db, queue);
  const buildings = buildingsRepository(db);
  const repository = activitiesRepository(db);
  const keyDates = keyDatesService(keyDatesRepository(db), async (projectId, explicit) => {
    if (explicit) return explicit;
    const buildingId = await buildings.soleRealBuildingId(projectId);
    if (!buildingId) throw new BadRequestError("buildingId is required for a multi-building project");
    return buildingId;
  });
  const calendarFor = async (projectId: string) => {
    const row = await repository.projectCalendar(projectId);
    return toCalendar(row?.working_days, row?.holidays);
  };
  const service = activitiesService(
    repository,
    // Synchronous on purpose: interactive edits must see progress_percent
    // updated before the response returns, or the UI refetch races the job.
    // Bulk paths (programme import, daily logs) still go through the queue.
    (projectId) => runProgressRecompute(db, { projectId }),
    (projectId) => buildings.soleRealBuildingId(projectId),
    {
      notifications: notifications.service,
      calendarFor,
    },
  );
  const delays = delaysService(repository, {
    calendarFor,
    // A programme move carries its non-contractual key dates with it; the
    // key-dates module owns that rule, so it runs through its service.
    onActivitiesShifted: async (projectId, moves) => {
      await keyDates.shiftForActivityMoves(
        projectId,
        moves.map((m) => ({ id: m.id, days: m.days })),
      );
    },
  });

  return { service, delays, repository, calendarFor, flush: notifications.flush };
}
