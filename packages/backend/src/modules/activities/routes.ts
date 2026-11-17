import { buildActivityServices } from "./wiring.ts";
import type { FastifyPluginAsync } from "fastify";
import type {
  CreateActivityInput,
  RaiseDelayInput,
  ResolveDelayInput,
  UpdateActivityInput,
} from "./types.ts";

import { projectIdParams, activityParams, delayParams, buildingQuery, createActivityBody, updateActivityBody, raiseDelayBody, resolveDelayBody, delaySchema, activityEventSchema } from "./route-schemas.ts";

const activityRoutes: FastifyPluginAsync = async (fastify) => {
  const { service, delays } = buildActivityServices(fastify.db, fastify.queue);

  fastify.get<{ Params: { id: string }; Querystring: { buildingId?: string } }>(
    "/projects/:id/activities",
    { schema: { params: projectIdParams, querystring: buildingQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
      return service.listByProject(project.id, request.query.buildingId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateActivityInput }>(
    "/projects/:id/activities",
    { schema: { params: projectIdParams, body: createActivityBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      const user = request.requireAuth();
      const activity = await service.create(project.id, request.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(activity);
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: { buildingId?: string } }>(
    "/projects/:id/programme/export.xml",
    { schema: { params: projectIdParams, querystring: buildingQuery } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
      const xml = await service.exportProgrammeXml(
        project.id,
        project.name,
        request.query.buildingId,
      );
      const fileName = `${project.name.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}-programme.xml`;
      return reply
        .header("content-type", "application/xml; charset=utf-8")
        .header("content-disposition", `attachment; filename="${fileName}"`)
        .send(xml);
    },
  );

  fastify.get<{ Params: { id: string; activityId: string } }>(
    "/projects/:id/activities/:activityId",
    { schema: { params: activityParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
      return service.getById(project.id, request.params.activityId);
    },
  );

  fastify.patch<{
    Params: { id: string; activityId: string };
    Body: UpdateActivityInput;
  }>(
    "/projects/:id/activities/:activityId",
    { schema: { params: activityParams, body: updateActivityBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      const user = request.requireAuth();
      return service.update(project.id, request.params.activityId, request.body, user.id);
    },
  );

  fastify.delete<{ Params: { id: string; activityId: string } }>(
    "/projects/:id/activities/:activityId",
    { schema: { params: activityParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      await service.remove(project.id, request.params.activityId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string; activityId: string } }>(
    "/projects/:id/activities/:activityId/delays",
    {
      schema: {
        params: activityParams,
        response: { 200: { type: "array", items: delaySchema } },
      },
    },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
      return delays.listForActivity(project.id, request.params.activityId);
    },
  );

  fastify.get<{ Params: { id: string; activityId: string } }>(
    "/projects/:id/activities/:activityId/events",
    {
      schema: {
        params: activityParams,
        response: { 200: { type: "array", items: activityEventSchema } },
      },
    },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
      return service.listEvents(project.id, request.params.activityId);
    },
  );

  fastify.post<{
    Params: { id: string; activityId: string };
    Body: RaiseDelayInput;
  }>(
    "/projects/:id/activities/:activityId/delays",
    { schema: { params: activityParams, body: raiseDelayBody, response: { 201: delaySchema } } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      const user = request.requireAuth();
      const delay = await delays.raise(project.id, request.params.activityId, request.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(delay);
    },
  );

  fastify.patch<{
    Params: { id: string; activityId: string; delayId: string };
    Body: ResolveDelayInput;
  }>(
    "/projects/:id/activities/:activityId/delays/:delayId",
    { schema: { params: delayParams, body: resolveDelayBody, response: { 200: delaySchema } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      const user = request.requireAuth();
      return delays.amend(
        project.id,
        request.params.activityId,
        request.params.delayId,
        request.body,
        { id: user.id, name: user.name },
      );
    },
  );

  fastify.get("/delay-reasons", async (request) => {
    request.requireAuth();
    return service.listReasons();
  });
};

export default activityRoutes;
