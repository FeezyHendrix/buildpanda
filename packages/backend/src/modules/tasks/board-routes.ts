import type { FastifyInstance } from "fastify";
import type { tasksService } from "./service.ts";
import type { TaskBoardFilters } from "./types.ts";
import { canSeeFullTaskBoard, assertCompanyTaskAccess } from "./access.ts";
import { taskStageRepository } from "./stage-repository.ts";
import { taskStageService } from "./stage-service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const boardQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    stageId: { type: "string", minLength: 1, maxLength: 200 },
    scope: { type: "string", enum: ["all", "assigned"] },
    buildingId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

const columnParams = {
  type: "object",
  required: ["id", "columnId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    columnId: { type: "string", minLength: 1 },
  },
} as const;

const createColumnBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: { name: { type: "string", minLength: 1, maxLength: 60 } },
} as const;

const renameColumnBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: { name: { type: "string", minLength: 1, maxLength: 60 } },
} as const;

const reorderColumnsBody = {
  type: "object",
  required: ["columnIds"],
  additionalProperties: false,
  properties: {
    columnIds: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 100 },
      minItems: 1,
      maxItems: 50,
    },
  },
} as const;

export function registerTaskBoardRoutes(fastify: FastifyInstance, service: ReturnType<typeof tasksService>): void {
  const stageFilter = taskStageService(taskStageRepository(fastify.db));
  fastify.get<{ Params: { id: string }; Querystring: TaskBoardFilters }>(
    "/projects/:id/tasks/board",
    { schema: { params: projectIdParams, querystring: boardQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "view");
      const user = request.requireAuth();
      assertCompanyTaskAccess(request, project);
      const fullBoard = canSeeFullTaskBoard(request, project);
      const assigneeId = request.query.scope === "assigned" || !fullBoard ? user.id : undefined;
      const board = await service.getDefaultBoard(project.id, user.id, assigneeId, request.query.buildingId);
      return stageFilter.filter(board, request.query.stageId);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/tasks/assignable",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "view");
      const user = request.requireAuth();
      assertCompanyTaskAccess(request, project);
      return service.listAssignable(
        project.id,
        project.organization_id,
        project.owner_id,
        user.id,
      );
    },
  );

  fastify.post<{ Params: { id: string }; Body: { name: string } }>(
    "/projects/:id/tasks/columns",
    { schema: { params: projectIdParams, body: createColumnBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "add");
      const user = request.requireAuth();
      const column = await service.addColumn(project.id, request.body.name, user.id);
      return reply.status(201).send(column);
    },
  );

  fastify.patch<{ Params: { id: string; columnId: string }; Body: { name: string } }>(
    "/projects/:id/tasks/columns/:columnId",
    { schema: { params: columnParams, body: renameColumnBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "add");
      return service.renameColumn(project.id, request.params.columnId, request.body.name);
    },
  );

  fastify.delete<{ Params: { id: string; columnId: string } }>(
    "/projects/:id/tasks/columns/:columnId",
    { schema: { params: columnParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "add");
      await service.deleteColumn(project.id, request.params.columnId);
      return reply.status(204).send();
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { columnIds: string[] } }>(
    "/projects/:id/tasks/columns/reorder",
    { schema: { params: projectIdParams, body: reorderColumnsBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "add");
      return service.reorderColumns(project.id, request.body.columnIds);
    },
  );

}
