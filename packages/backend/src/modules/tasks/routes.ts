import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { canProjectPermission } from "../../lib/authorization.ts";
import { isEmployeeRole } from "../../lib/permissions.ts";
import { ForbiddenError } from "../../lib/errors.ts";
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
    scope: { type: "string", enum: ["all", "assigned"] },
  },
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
    description: { type: ["string", "null"], maxLength: 50000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    assigneeTeamMemberId: { type: ["string", "null"], maxLength: 100 },
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

const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
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
      enum: ["action_item", "rfi", "change_request", "material", "invoice", "milestone_payment"],
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
  const service = tasksService(tasksRepository(fastify.db), {
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
  });

  function canSeeFullTaskBoard(request: FastifyRequest, project: ProjectRow): boolean {
    const user = request.requireAuth();
    if (project.owner_id === user.id) return true;

    // Company managers (any non-viewer org role on this project) manage the whole
    // board — this mirrors the isCompanyManager capability the client uses to
    // enable drag, so the UI and API agree. Employees are scoped to assigned
    // tasks; org viewers and external participants never get the full board.
    const orgId = project.organization_id;
    const orgRole = orgId ? request.orgRoles.get(orgId) : undefined;
    if (orgRole && orgRole !== "viewer" && !isEmployeeRole(orgRole)) return true;

    return canProjectPermission(
      { id: project.id, ownerId: project.owner_id, organizationId: orgId },
      {
        userId: user.id,
        orgRoles: request.orgRoles,
        projectRoles: request.projectRoles,
        projectSectionPermissions: request.projectSectionPermissions,
        orgPermissions: request.orgPermissions,
      },
      "tasks",
      "remove",
    );
  }

  function assertCompanyTaskAccess(request: FastifyRequest, project: ProjectRow): void {
    const user = request.requireAuth();
    if (project.owner_id === user.id) return;
    if (project.organization_id && request.orgRoles.has(project.organization_id)) return;
    throw new ForbiddenError("Only company team members can access the task board");
  }

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

  fastify.get<{ Params: { id: string }; Querystring: { scope?: "all" | "assigned" } }>(
    "/projects/:id/tasks/board",
    { schema: { params: projectIdParams, querystring: boardQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "view");
      const user = request.requireAuth();
      assertCompanyTaskAccess(request, project);
      const fullBoard = canSeeFullTaskBoard(request, project);
      const assigneeId = request.query.scope === "assigned" || !fullBoard ? user.id : undefined;
      return service.getDefaultBoard(project.id, user.id, assigneeId);
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
