import { buildLookAheadsService } from "./wiring.ts";
import type { FastifyPluginAsync } from "fastify";
import { autoWindowService } from "./auto-window.ts";
import type {
  CreateLookAheadInput,
  LookAheadStatus,
  LookAheadTimeline,
  UpdateLookAheadInput,
} from "./types.ts";

import { projectIdParams, lookAheadParams, listQuery, autoWindowQuery, lookAheadBody, lookAheadPatchBody, approveBody, revokeBody } from "./route-schemas.ts";

const lookAheadRoutes: FastifyPluginAsync = async (fastify) => {
  const service = buildLookAheadsService(fastify.db);
  const autoWindow = autoWindowService(fastify.db);

  fastify.get<{
    Params: { id: string };
    Querystring: {
      status?: LookAheadStatus;
      timeline?: LookAheadTimeline;
      activityId?: string;
      buildingId?: string;
      sort?: "startDate" | "endDate" | "status";
      order?: "asc" | "desc";
    };
  }>("/projects/:id/look-aheads", { schema: { params: projectIdParams, querystring: listQuery } }, async (request) => {
    const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
    return service.list(project.id, request.query);
  });

  fastify.get<{ Params: { id: string }; Querystring: { weeks?: number } }>(
    "/projects/:id/look-aheads/auto-window",
    { schema: { params: projectIdParams, querystring: autoWindowQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
      return autoWindow.build(project.id, request.query.weeks ?? 4);
    },
  );

  fastify.get<{ Params: { id: string; lookAheadId: string } }>(
    "/projects/:id/look-aheads/:lookAheadId",
    { schema: { params: lookAheadParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
      return service.get(project.id, request.params.lookAheadId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateLookAheadInput }>(
    "/projects/:id/look-aheads",
    { schema: { params: projectIdParams, body: lookAheadBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      const user = request.requireAuth();
      const lookAhead = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(lookAhead);
    },
  );

  fastify.patch<{ Params: { id: string; lookAheadId: string }; Body: UpdateLookAheadInput }>(
    "/projects/:id/look-aheads/:lookAheadId",
    { schema: { params: lookAheadParams, body: lookAheadPatchBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      return service.update(project.id, request.params.lookAheadId, request.body);
    },
  );

  fastify.post<{ Params: { id: string; lookAheadId: string }; Body: { note?: string | null } }>(
    "/projects/:id/look-aheads/:lookAheadId/approve",
    { schema: { params: lookAheadParams, body: approveBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      const user = request.requireAuth();
      return service.approve(project.id, request.params.lookAheadId, request.body ?? {}, {
        id: user.id,
        name: user.name ?? null,
      });
    },
  );

  fastify.post<{ Params: { id: string; lookAheadId: string }; Body: { reason?: string | null } }>(
    "/projects/:id/look-aheads/:lookAheadId/revoke-approval",
    { schema: { params: lookAheadParams, body: revokeBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      return service.revokeApproval(project.id, request.params.lookAheadId, request.body?.reason ?? null);
    },
  );

  fastify.delete<{ Params: { id: string; lookAheadId: string } }>(
    "/projects/:id/look-aheads/:lookAheadId",
    { schema: { params: lookAheadParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      await service.remove(project.id, request.params.lookAheadId);
      return reply.status(204).send();
    },
  );
};

export default lookAheadRoutes;
