import { filterTaskEntityAccess, requireTaskEntityTargetRead } from "./entity-access.ts";
import { taskEntityAccessRepository } from "./entity-access-repository.ts";
import { buildTasksServices } from "./wiring.ts";
import { registerTaskBoardRoutes } from "./board-routes.ts";
import { canSeeFullTaskBoard, assertTaskBoardAccess } from "./access.ts";
import type { FastifyPluginAsync } from "fastify";
import {
  type CreateTaskInput,
  type MoveTaskInput,
  type UpdateTaskInput,
} from "./service.ts";
import type { TaskEntityType, TaskRecordParams } from "./types.ts";

import { projectIdParams, taskParams, createBody, updateBody, moveBody, commentBody, subtaskParams, createSubtaskBody, updateSubtaskBody, createLinkBody, createEntityLinkBody, linkParams } from "./route-schemas.ts";

const taskRoutes: FastifyPluginAsync = async (fastify) => {
  const { service, visibility } = buildTasksServices(fastify.db, fastify.queue);
  // Every child route (comments, subtasks and links included) inherits record visibility.
  fastify.addHook("preHandler", async (request) => {
    const { id, taskId } = request.params as TaskRecordParams;
    if (!id || !taskId) return;
    const project = await request.requireProjectPermission(id, "tasks", "view");
    await visibility.requireVisible(id, taskId, canSeeFullTaskBoard(request, project) ? undefined : request.requireAuth().id);
  });

  registerTaskBoardRoutes(fastify, service);

  fastify.post<{ Params: { id: string }; Body: CreateTaskInput }>(
    "/projects/:id/tasks",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "add");
      await request.requireProjectPermission(project.id, "tasks", "view");
      assertTaskBoardAccess(request, project);
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
      await request.requireProjectPermission(project.id, "tasks", "view");
      assertTaskBoardAccess(request, project);
      const user = request.requireAuth();
      return service.updateTask(project.id, request.params.taskId, request.body, user.id);
    },
  );

  fastify.patch<{ Params: { id: string; taskId: string }; Body: MoveTaskInput }>(
    "/projects/:id/tasks/:taskId/move",
    { schema: { params: taskParams, body: moveBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "view");
      assertTaskBoardAccess(request, project);
      return service.moveTask(project.id, request.params.taskId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; taskId: string } }>(
    "/projects/:id/tasks/:taskId",
    { schema: { params: taskParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "remove");
      await request.requireProjectPermission(project.id, "tasks", "view");
      assertTaskBoardAccess(request, project);
      await service.removeTask(project.id, request.params.taskId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string; taskId: string } }>(
    "/projects/:id/tasks/:taskId",
    { schema: { params: taskParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "tasks", "view");
      assertTaskBoardAccess(request, project);
      const detail = await visibility.detail(await service.getTaskDetail(project.id, request.params.taskId),
        canSeeFullTaskBoard(request, project) ? undefined : request.requireAuth().id);
      return filterTaskEntityAccess(request, project, detail, taskEntityAccessRepository(fastify.db));
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
      await visibility.requireVisible(project.id, request.body.targetTaskId, canSeeFullTaskBoard(request, project) ? undefined : user.id);
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
      await requireTaskEntityTargetRead(request, project, request.body.entityType, request.body.entityId, taskEntityAccessRepository(fastify.db));
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
      assertTaskBoardAccess(request, project);
      return service.listComments(project.id, request.params.taskId);
    },
  );

  fastify.post<{ Params: { id: string; taskId: string }; Body: { body: string } }>(
    "/projects/:id/tasks/:taskId/comments",
    { schema: { params: taskParams, body: commentBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "comments", "post");
      await request.requireProjectPermission(project.id, "tasks", "view");
      assertTaskBoardAccess(request, project);
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
