import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { mapAllows } from "../../../lib/permissions.ts";
import { preconRepository } from "../pdf-takeoff/repository.ts";
import { preconService } from "../pdf-takeoff/service.ts";
import { preconAssistRepository } from "./repository.ts";
import { preconAssistService } from "./service.ts";
import { ASSIST_SURFACES, type AssistRequestBody, type CanFn, type ChangeSetParams } from "./types.ts";

const assistBody = {
  type: "object",
  required: ["surface", "prompt"],
  additionalProperties: false,
  properties: {
    sessionId: { type: "string", minLength: 1, maxLength: 100 },
    proposalId: { type: "string", minLength: 1, maxLength: 100 },
    surface: { type: "string", enum: ASSIST_SURFACES },
    prompt: { type: "string", minLength: 3, maxLength: 2000 },
  },
} as const;

const changeSetParams = {
  type: "object",
  required: ["changeSetId"],
  additionalProperties: false,
  properties: { changeSetId: { type: "string", minLength: 1 } },
} as const;

const sessionParams = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

// The assistant applies each change through the same grants the buttons use;
// the route hands the service a checker bound to the caller's active org.
function canFor(request: FastifyRequest, orgId: string): CanFn {
  const perms = request.orgPermissions?.get(orgId);
  return (resource, action) => (perms ? mapAllows(perms, resource, action) : false);
}

const preconAssistRoutes: FastifyPluginAsync = async (fastify) => {
  const preconRepo = preconRepository(fastify.db);
  const precon = preconService(preconRepo, (sessionId, event) => {
    fastify.realtime.publish({ event: event.type, channelId: `precon:${sessionId}`, data: event });
  });
  const service = preconAssistService(preconAssistRepository(fastify.db), { precon, preconRepo });

  fastify.post<{ Body: AssistRequestBody }>("/precon/assist", { schema: { body: assistBody } }, async (request, reply) => {
    const user = request.requireAuth();
    const orgId = request.requireOrgPermission("takeoffs", "view");
    const changeSet = await service.propose(request.body, user.id, orgId);
    return reply.status(201).send(changeSet);
  });

  fastify.get<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/change-sets",
    { schema: { params: sessionParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      return service.listForSession(request.params.sessionId, orgId);
    },
  );

  fastify.get<{ Params: ChangeSetParams }>("/precon/change-sets/:changeSetId", { schema: { params: changeSetParams } }, async (request) => {
    request.requireAuth();
    const orgId = request.requireOrgPermission("takeoffs", "view");
    return service.get(request.params.changeSetId, orgId);
  });

  fastify.post<{ Params: ChangeSetParams }>(
    "/precon/change-sets/:changeSetId/apply",
    { schema: { params: changeSetParams } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      return service.apply(request.params.changeSetId, user.id, orgId, canFor(request, orgId));
    },
  );

  fastify.post<{ Params: ChangeSetParams }>(
    "/precon/change-sets/:changeSetId/undo",
    { schema: { params: changeSetParams } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      return service.undo(request.params.changeSetId, user.id, orgId, canFor(request, orgId));
    },
  );

  fastify.post<{ Params: ChangeSetParams }>(
    "/precon/change-sets/:changeSetId/discard",
    { schema: { params: changeSetParams } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      return service.discard(request.params.changeSetId, user.id, orgId);
    },
  );
};

export default preconAssistRoutes;
