import { filterTaskEntityAccess } from "../tasks/entity-access.ts";
import { taskEntityAccessRepository } from "../tasks/entity-access-repository.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { isCompanyCaller } from "../rfis/access.ts";
import { buildRfiServices } from "../rfis/wiring.ts";
import { listQuery as rfiQuery } from "../rfis/route-schemas.ts";
import type { RfiListFilters } from "../rfis/types.ts";
import { buildChangeServices } from "../change-requests/wiring.ts";
import { CHANGE_STATUSES, type ChangeStatus } from "../change-requests/types.ts";
import { buildLookAheadsService } from "../look-aheads/wiring.ts";
import { listQuery as lookAheadQuery } from "../look-aheads/route-schemas.ts";
import type { LookAheadListFilters } from "../look-aheads/types.ts";
import { buildTasksServices } from "../tasks/wiring.ts";
import { canSeeFullTaskBoard } from "../tasks/access.ts";
import { taskStageService } from "../tasks/stage-service.ts";
import { taskStageRepository } from "../tasks/stage-repository.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import { readTool, targetFields, buildingFields, idField, textArg, omitArgs } from "./read-tools-support.ts";

export function workRecordReadTools() {
  return [
    readTool("read_rfi", "Read RFIs, or one RFI with its full comments, official response and event history. External project participants see shared RFIs only.", {
      ...targetFields, ...rfiQuery.properties,
    }, async (context, args) => {
      const service = buildRfiServices(context.db).service;
      const sharedOnly = !isCompanyCaller(context.request, context.project);
      const id = textArg(args, "targetId");
      if (id) return service.get(context.project.id, id, sharedOnly);
      const filter = validateFieldPayload<RfiListFilters>(rfiQuery, omitArgs(args, "targetId"));
      return service.list(context.project.id, { status: filter.status, stageId: filter.stageId, sharedOnly,
        ...(args.ballInCourt === "mine" ? { ballInCourtId: context.user.id } : {}),
      });
    }),
    readTool("read_change_request", "Read the change register or a change's full rich description, revisions, EOT evidence, decision and comments.", {
      ...targetFields, status: { type: "string", enum: CHANGE_STATUSES }, summary: { type: "boolean" },
    }, async (context, args) => {
      const service = buildChangeServices(context.db).service;
      const id = textArg(args, "targetId");
      return id ? service.get(context.project.id, id) : args.summary ? service.summary(context.project.id) : service.list(context.project.id, args.status as ChangeStatus | undefined);
    }),
    readTool("read_look_ahead", "Read look-ahead programmes, their linked activities, crew requirements and immutable approval details.", {
      ...targetFields, ...lookAheadQuery.properties,
    }, async (context, args) => {
      const service = buildLookAheadsService(context.db);
      const id = textArg(args, "targetId");
      if (id) {
        const record = await service.get(context.project.id, id);
        if (context.buildingId && record.buildingId !== context.buildingId) throw new NotFoundError("Look-ahead in selected building");
        return record;
      }
      return service.list(context.project.id, validateFieldPayload<LookAheadListFilters>(lookAheadQuery, omitArgs(args, "targetId")));
    }),
    readTool("read_task", "Read an existing task board, assignable people, or one task with subtasks, linked records and comments. Own/assigned visibility is enforced; this never creates an empty board.", {
      ...targetFields, ...buildingFields, stageId: idField, scope: { type: "string", enum: ["all", "assigned", "mine"] },
      view: { type: "string", enum: ["board", "assignable"] },
    }, async (context, args) => {
      const { service, visibility } = buildTasksServices(context.db);
      const full = canSeeFullTaskBoard(context.request, context.project);
      const readerId = full ? undefined : context.user.id;
      const id = textArg(args, "targetId");
      if (id) {
        await visibility.requireVisible(context.project.id, id, readerId);
        if (context.buildingId) {
          const board = await service.getExistingBoard(context.project.id, context.buildingId);
          if (!board?.tasks.some((task) => task.id === id)) throw new NotFoundError("Task in selected building");
        }
        const detail = await visibility.detail(await service.getTaskDetail(context.project.id, id), readerId);
        return filterTaskEntityAccess(context.request, context.project, detail, taskEntityAccessRepository(context.db));
      }
      if (args.view === "assignable") return service.listAssignable(context.project.id, context.project.organization_id, context.project.owner_id, context.user.id);
      const board = await service.getExistingBoard(context.project.id, context.buildingId ?? undefined);
      if (!board) return { board: null, tasks: [], columns: [] };
      const visible = await visibility.board(board, context.user.id, full && args.scope !== "mine", args.scope === "assigned");
      return taskStageService(taskStageRepository(context.db)).filter(visible, textArg(args, "stageId"));
    }),
  ];
}
