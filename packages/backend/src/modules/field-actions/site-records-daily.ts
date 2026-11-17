import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { buildingsService } from "../buildings/service.ts";
import { dailyLogsRepository } from "../daily-logs/repository.ts";
import { dailyLogsService } from "../daily-logs/service.ts";
import { dailyLogEntryVoidActor } from "../daily-logs/access.ts";
import { authorizeDailyLogScope } from "./authorization.ts";
import { dailyLogExecutor } from "./daily-log.ts";
import type { DailyLogCommand } from "./types.ts";
import type { FieldToolHandler } from "./tool-types.ts";

export const dailyRecordHandler: FieldToolHandler = async (input, context) => {
  await context.requireFeature("quality.dailyLogs", "Daily logs");
  const projectId = input.projectId;
  if (input.kind !== "void_daily_log_entry") {
    const { logDate, ...body } = input.payload;
    const selected = input.buildingId ?? (typeof body.buildingId === "string" ? body.buildingId : undefined);
    const scope = await authorizeDailyLogScope(context.db, context.actor, projectId, selected);
    const result = await dailyLogExecutor(context.db).execute({ kind: input.kind, projectId, buildingId: scope.buildingId,
      logDate, payload: body } as DailyLogCommand, context.actor);
    return { kind: input.kind, projectId, recordId: result.recordId, data: { buildingId: result.buildingId, logDate: result.logDate } };
  }
  const project = await context.request.requireProjectPermission(projectId, "dailyLog", "create");
  const repository = dailyLogsRepository(context.db), entryId = input.payload.entryId as string;
  const entry = await repository.findEntryById(entryId);
  if (!entry || entry.project_id !== projectId) throw new NotFoundError("Daily log entry");
  if (input.buildingId && input.buildingId !== entry.building_id) throw new BadRequestError("The diary entry belongs to another building");
  await buildingsService(buildingsRepository(context.db)).assertRealBuilding(projectId, entry.building_id);
  const result = await dailyLogsService(repository).voidEntry(projectId, entryId, input.payload.reason as string,
    dailyLogEntryVoidActor(context.request, project, context.user));
  return { kind: input.kind, projectId, recordId: result.id };
};
