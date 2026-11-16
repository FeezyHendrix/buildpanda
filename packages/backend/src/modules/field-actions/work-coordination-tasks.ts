import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { canSeeFullTaskBoard, assertTaskBoardAccess } from "../tasks/access.ts";
import { tasksRepository } from "../tasks/repository.ts";
import { buildTasksServices } from "../tasks/wiring.ts";
import * as schemas from "../tasks/route-schemas.ts";
import type { CreateTaskInput, UpdateTaskInput, MoveTaskInput } from "../tasks/service.ts";
import type { FieldToolHandler } from "./tool-types.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import { coordinationPayload, bodyWithoutTarget, coordinationBuilding, assertTargetBuilding } from "./work-coordination-support.ts";

const taskHandler: FieldToolHandler = async (input, context) => {
  const payload = coordinationPayload(input);
  const { request, project, user, db } = context;
  await request.requireProjectPermission(project.id, "tasks", "view");
  assertTaskBoardAccess(request, project);
  const { service, visibility, flush } = buildTasksServices(db, context.queue);
  const repository = tasksRepository(db);
  const taskId = payload.taskId as string;
  if (input.kind !== "create_task") {
    await visibility.requireVisible(project.id, taskId, canSeeFullTaskBoard(request, project) ? undefined : user.id);
    const current = await repository.findTaskById(taskId);
    if (!current || current.project_id !== project.id) throw new NotFoundError("Task");
    assertTargetBuilding(context, current.building_id);
  }
  const permission = input.kind === "delete_task" ? "remove" : input.kind === "move_task" ? "view" : "add";
  if (input.kind === "comment_task") await request.requireProjectPermission(project.id, "comments", "post");
  else await request.requireProjectPermission(project.id, "tasks", permission);
  await context.requireFiles(payload);

  let recordId = taskId;
  if (input.kind === "create_task" || input.kind === "update_task") {
    const body = input.kind === "create_task" ? validateFieldPayload<CreateTaskInput>(schemas.createBody, payload)
      : bodyWithoutTarget<UpdateTaskInput>(payload, "taskId", schemas.updateBody);
    if (body.assignees || body.assigneeId || body.assigneeTeamMemberId) {
      const assignable = await service.listAssignable(project.id, project.organization_id, project.owner_id, user.id);
      const known = new Set(assignable.map((entry) => `${entry.kind}:${entry.id}`));
      const requested = body.assignees ?? [
        ...(body.assigneeId ? [{ kind: "user", id: body.assigneeId }] : []),
        ...(body.assigneeTeamMemberId ? [{ kind: "team", id: body.assigneeTeamMemberId }] : []),
      ];
      if (requested.some((entry) => !known.has(`${entry.kind}:${entry.id}`))) throw new BadRequestError("Choose an assignee from this project's participants.");
    }
    if (input.kind === "create_task") {
      const buildingId = await coordinationBuilding(context, (body as CreateTaskInput).buildingId);
      recordId = (await service.createTask(project.id, { ...body as CreateTaskInput, buildingId }, user.id)).id;
    } else recordId = (await service.updateTask(project.id, taskId, body, user.id)).id;
  } else if (input.kind === "move_task") {
    const { taskId: _target, ...body } = payload;
    if (body.position === undefined) body.position = await repository.maxPositionInColumn(body.columnId as string) + 1000;
    const movement = validateFieldPayload<MoveTaskInput>(schemas.moveBody, body);
    await service.moveTask(project.id, taskId, movement);
  } else if (input.kind === "delete_task") await service.removeTask(project.id, taskId);
  else {
    const body = bodyWithoutTarget<{ body: string }>(payload, "taskId", schemas.commentBody);
    recordId = (await service.addComment(project.id, taskId, body.body, { id: user.id, name: user.name })).id;
  }
  await flush();
  return { kind: input.kind, projectId: project.id, recordId };
};

export const workTaskHandlers = {
  create_task: taskHandler, update_task: taskHandler, move_task: taskHandler,
  delete_task: taskHandler, comment_task: taskHandler,
} satisfies Record<string, FieldToolHandler>;
