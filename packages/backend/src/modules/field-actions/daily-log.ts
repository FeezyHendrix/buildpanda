import type { Knex } from "knex";
import { buildingsRepository } from "../buildings/repository.ts";
import { buildingsService } from "../buildings/service.ts";
import { dailyLogsRepository } from "../daily-logs/repository.ts";
import { dailyLogsService } from "../daily-logs/service.ts";
import { dailyLogTemplatesRepository } from "../daily-log-templates/repository.ts";
import { dailyLogTemplatesService } from "../daily-log-templates/service.ts";
import { requireProjectFileReferences } from "../files/attachment-access.ts";
import { fileAccessRepository } from "../files/access-repository.ts";
import { filesRepository } from "../files/repository.ts";
import { authorizeDailyLogScope } from "./authorization.ts";
import { fieldActionsRepository } from "./repository.ts";
import { validateDailyLogCommand } from "./validation.ts";
import type { DailyLogCommand, DailyLogExecutionDeps, FieldActionResult, FieldActor } from "./types.ts";

export function createDailyLogExecutor(deps: DailyLogExecutionDeps) {
  return {
    async execute(input: DailyLogCommand, actor: FieldActor): Promise<FieldActionResult> {
      const command = validateDailyLogCommand(input);
      await deps.lockTarget(command);
      const scope = await deps.authorize(actor, command.projectId, command.buildingId);
      await deps.requireFiles(scope.request, command.projectId, command.payload);
      const result = command.kind === "daily_log"
        ? await deps.logs.addEntry(command.projectId, command.logDate, command.payload, scope.author)
        : await deps.logs.upsert(command.projectId, command.logDate, command.payload, scope.author.id);
      return {
        kind: command.kind, projectId: command.projectId, buildingId: scope.buildingId, logDate: command.logDate,
        recordId: "id" in result ? result.id : `${command.projectId}:${scope.buildingId}:${command.logDate}`,
      };
    },
  };
}

function transactionalExecutor(db: Knex) {
  const buildings = buildingsRepository(db);
  const templates = dailyLogTemplatesService(dailyLogTemplatesRepository(db));
  const logs = dailyLogsService(dailyLogsRepository(db), {
    assertBuilding: buildingsService(buildings).assertRealBuilding,
    fillTemplate: (projectId, templateId, responses) => templates.fill(projectId, templateId, responses),
  }, buildings.soleRealBuildingId);
  return createDailyLogExecutor({
    lockTarget: fieldActionsRepository(db).lockDailyTarget,
    authorize: (actor, projectId, buildingId) => authorizeDailyLogScope(db, actor, projectId, buildingId),
    logs,
    requireFiles: (request, projectId, payload) => requireProjectFileReferences(
      { ...request, body: payload }, projectId, filesRepository(db), fileAccessRepository(db),
    ),
  });
}

/** A caller's transaction also includes its action receipt; standalone calls own their transaction. */
export function dailyLogExecutor(db: Knex) {
  return {
    execute(input: DailyLogCommand, actor: FieldActor): Promise<FieldActionResult> {
      return db.isTransaction
        ? transactionalExecutor(db).execute(input, actor)
        : db.transaction((transaction) => transactionalExecutor(transaction).execute(input, actor));
    },
  };
}
