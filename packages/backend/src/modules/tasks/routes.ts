import { registerTaskBoardRoutes } from "./board-routes.ts";
import { canSeeFullTaskBoard, assertCompanyTaskAccess } from "./access.ts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { ForbiddenError } from "../../lib/errors.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { tasksRepository } from "./repository.ts";
import {
  tasksService,
  type CreateTaskInput,
  type MoveTaskInput,
  type UpdateTaskInput,
} from "./service.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import type { TaskEntityType } from "./types.ts";
import type { ProjectRow } from "../projects/types.ts";

const STATUS = ["Todo", "Doing", "Done"] as const;
const PRIORITY = ["Low", "Medium", "High"] as const;

const assigneesSchema = {
  type: "array",
  maxItems: 20,
  items: {
    type: "object",
    required: ["kind", "id"],
    additionalProperties: false,
    properties: {
      kind: { type: "string", enum: ["user", "team"] },
      id: { type: "string", minLength: 1, maxLength: 100 },
    },
  },
} as const;

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const taskParams = {
  type: "object",
  required: ["id", "taskId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    taskId: { type: "string", minLength: 1 },
  },
} as const;

const createBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    buildingId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    description: { type: ["string", "null"], maxLength: 50000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    assigneeTeamMemberId: { type: ["string", "null"], maxLength: 100 },
    assignees: assigneesSchema,
    dueDate: { type: ["string", "null"], maxLength: 40 },
    priority: { type: "string", enum: PRIORITY },
    labels: { type: "array", maxItems: 20, items: { type: "string", maxLength: 40 } },
    columnId: { type: ["string", "null"], maxLength: 100 },
    status: { type: "string", enum: STATUS },
  },
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 50000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    assigneeTeamMemberId: { type: ["string", "null"], maxLength: 100 },
    assignees: assigneesSchema,
    dueDate: { type: ["string", "null"], maxLength: 40 },
    priority: { type: "string", enum: PRIORITY },
    labels: { type: "array", maxItems: 20, items: { type: "string", maxLength: 40 } },
  },
} as const;

const moveBody = {
  type: "object",
  required: ["columnId", "position"],
  additionalProperties: false,
  properties: {
    columnId: { type: "string", minLength: 1, maxLength: 100 },
    position: { type: "number" },
  },
} as const;

const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
} as const;

const subtaskParams = {
  type: "object",
  required: ["id", "taskId", "subtaskId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    taskId: { type: "string", minLength: 1 },
    subtaskId: { type: "string", minLength: 1 },
  },
} as const;

const createSubtaskBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: { title: { type: "string", minLength: 1, maxLength: 300 } },
} as const;

const updateSubtaskBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 300 },
    done: { type: "boolean" },
  },
} as const;

const createLinkBody = {
  type: "object",
  required: ["targetTaskId"],
  additionalProperties: false,
  properties: {
    targetTaskId: { type: "string", minLength: 1, maxLength: 100 },
    linkType: { type: "string", enum: ["relates_to", "blocks", "blocked_by", "duplicates"] },
  },
} as const;

const createEntityLinkBody = {
  type: "object",
  required: ["entityType", "entityId"],
  additionalProperties: false,
  properties: {
    entityType: {
      type: "string",
      enum: ["rfi", "change_request", "material", "invoice", "milestone_payment"],
    },
    entityId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

const linkParams = {
  type: "object",
  required: ["id", "taskId", "linkId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    taskId: { type: "string", minLength: 1 },
    linkId: { type: "string", minLength: 1 },
  },
} as const;

const taskRoutes: FastifyPluginAsync = async (fastify) => {
  const buildings = buildingsRepository(fastify.db);
  const service = tasksService(tasksRepository(fastify.db), {
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
  }, async (projectId) =>
    (await buildings.soleRealBuildingId(projectId)) ?? (await buildings.firstRealBuildingId(projectId)));

  async function assertTaskVisibleToRequester(
    request: FastifyRequest,
    project: ProjectRow,
    taskId: string,
  ): Promise<void> {
    if (canSeeFullTaskBoard(request, project)) return;
    const user = request.requireAuth();
    if (await service.isTaskAssignedToUser(project.id, taskId, user.id)) return;
    throw new ForbiddenError("You can only access tasks assigned to you");
  }

  registerTaskBoardRoutes(fastify, service);

  fastify.post<{ Params: { id: string }; Body: CreateTaskInput }>(
    "/projects/:id/tasks",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "add");
      const user = request.requireAuth();
      const task = await service.createTask(project.id, request.body, user.id);
      return reply.status(201).send(task);
    },
  );

  fastify.patch<{ Params: { id: string; taskId: string }; Body: UpdateTaskInput }>(
    "/projects/:id/tasks/:taskId",
    { schema: { params: taskParams, body: updateBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "add");
      const user = request.requireAuth();
      return service.updateTask(project.id, request.params.taskId, request.body, user.id);
    },
  );

  fastify.patch<{ Params: { id: string; taskId: string }; Body: MoveTaskInput }>(
    "/projects/:id/tasks/:taskId/move",
    { schema: { params: taskParams, body: moveBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "view");
      assertCompanyTaskAccess(request, project);
      await assertTaskVisibleToRequester(request, project, request.params.taskId);
      return service.moveTask(project.id, request.params.taskId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; taskId: string } }>(
    "/projects/:id/tasks/:taskId",
    { schema: { params: taskParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "remove");
      await service.removeTask(project.id, request.params.taskId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string; taskId: string } }>(
    "/projects/:id/tasks/:taskId",
    { schema: { params: taskParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "view");
      assertCompanyTaskAccess(request, project);
      await assertTaskVisibleToRequester(request, project, request.params.taskId);
      return service.getTaskDetail(project.id, request.params.taskId);
    },
  );

  fastify.post<{ Params: { id: string; taskId: string }; Body: { title: string } }>(
    "/projects/:id/tasks/:taskId/subtasks",
    { schema: { params: taskParams, body: createSubtaskBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "add");
      const subtask = await service.addSubtask(project.id, request.params.taskId, request.body.title);
      return reply.status(201).send(subtask);
    },
  );

  fastify.patch<{ Params: { id: string; taskId: string; subtaskId: string }; Body: { title?: string; done?: boolean } }>(
    "/projects/:id/tasks/:taskId/subtasks/:subtaskId",
    { schema: { params: subtaskParams, body: updateSubtaskBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "add");
      return service.updateSubtask(project.id, request.params.taskId, request.params.subtaskId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; taskId: string; subtaskId: string } }>(
    "/projects/:id/tasks/:taskId/subtasks/:subtaskId",
    { schema: { params: subtaskParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "add");
      await service.removeSubtask(project.id, request.params.taskId, request.params.subtaskId);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { id: string; taskId: string }; Body: { targetTaskId: string; linkType?: string } }>(
    "/projects/:id/tasks/:taskId/links",
    { schema: { params: taskParams, body: createLinkBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "add");
      const user = request.requireAuth();
      const link = await service.addLink(
        project.id,
        request.params.taskId,
        request.body.targetTaskId,
        request.body.linkType ?? "relates_to",
        user.id,
      );
      return reply.status(201).send(link);
    },
  );

  fastify.delete<{ Params: { id: string; taskId: string; linkId: string } }>(
    "/projects/:id/tasks/:taskId/links/:linkId",
    { schema: { params: linkParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "add");
      await service.removeLink(project.id, request.params.taskId, request.params.linkId);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { id: string; taskId: string }; Body: { entityType: TaskEntityType; entityId: string } }>(
    "/projects/:id/tasks/:taskId/entity-links",
    { schema: { params: taskParams, body: createEntityLinkBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "add");
      const user = request.requireAuth();
      const link = await service.addEntityLink(
        project.id,
        request.params.taskId,
        request.body.entityType,
        request.body.entityId,
        user.id,
      );
      return reply.status(201).send(link);
    },
  );

  fastify.delete<{ Params: { id: string; taskId: string; linkId: string } }>(
    "/projects/:id/tasks/:taskId/entity-links/:linkId",
    { schema: { params: linkParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "add");
      await service.removeEntityLink(project.id, request.params.taskId, request.params.linkId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string; taskId: string } }>(
    "/projects/:id/tasks/:taskId/comments",
    { schema: { params: taskParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "view");
      assertCompanyTaskAccess(request, project);
      await assertTaskVisibleToRequester(request, project, request.params.taskId);
      return service.listComments(project.id, request.params.taskId);
    },
  );

  fastify.post<{ Params: { id: string; taskId: string }; Body: { body: string } }>(
    "/projects/:id/tasks/:taskId/comments",
    { schema: { params: taskParams, body: commentBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "comments", "post");
      const user = request.requireAuth();
      const comment = await service.addComment(project.id, request.params.taskId, request.body.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(comment);
    },
  );
};

export default taskRoutes;
