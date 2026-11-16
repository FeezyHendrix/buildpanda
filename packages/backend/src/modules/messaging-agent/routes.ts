import type { FastifyPluginAsync } from "fastify";
import AjvCompiler from "@fastify/ajv-compiler";
import type { MessagingDraftInput, MessagingLinkInput, MessagingReviewInput } from "./management-types.ts";
import { requireMessagingEnabled, messagingAgentService } from "./service.ts";
import * as schemas from "./schemas.ts";
import { configuredMessagingAdapters, messagingAdapterRoutes } from "./adapters/index.ts";
import { messagingAgentRecoveryService } from "./recovery-service.ts";
import messagingUploadRoutes from "./upload-routes.ts";

const messagingAgentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.setValidatorCompiler(AjvCompiler()({}, { customOptions: { strict: false, removeAdditional: false, coerceTypes: false } }));
  const adapters = configuredMessagingAdapters();
  const service = messagingAgentService(fastify.db, adapters, fastify.queue);
  await fastify.register(messagingAdapterRoutes);
  await fastify.register(messagingUploadRoutes, { adapters });

  fastify.get("/messaging-agent/status", { schema: { response: { 200: schemas.statusResponse } } },
    (request) => service.status(request.requireAuth().id));
  fastify.post<{ Body: MessagingLinkInput }>("/messaging-agent/link", {
    schema: { body: schemas.linkBody, response: { 200: schemas.linkResponse } },
    config: { rateLimit: { max: 10, timeWindow: 60_000 } },
  }, (request) => service.link(request.requireAuth().id, request.body));
  fastify.delete<{ Params: { connectionId: string } }>("/messaging-agent/connections/:connectionId", { schema: { params: schemas.connectionParams } }, async (request, reply) => {
    await service.unlink(request.requireAuth().id, request.params.connectionId);
    return reply.status(204).send();
  });
  fastify.get<{ Params: { projectId: string }; Querystring: { connectionId?: string } }>("/messaging-agent/projects/:projectId/session", {
    schema: { params: schemas.projectParams, querystring: schemas.sessionQuery, response: { 200: schemas.sessionResponse } },
  }, (request) => service.session(request.requireAuth().id, request.params.projectId, request.query.connectionId));
  fastify.get<{ Params: { projectId: string }; Querystring: { connectionId?: string } }>("/messaging-agent/projects/:projectId/tools", {
    schema: { params: schemas.projectParams, querystring: schemas.sessionQuery, response: { 200: schemas.toolsResponse } },
  }, (request) => service.tools(request.requireAuth().id, request.params.projectId, request.query.connectionId));
  fastify.patch<{ Params: { projectId: string }; Body: { connectionId: string; buildingId: string | null } }>("/messaging-agent/projects/:projectId/scope", {
    schema: { params: schemas.projectParams, body: schemas.scopeBody },
  }, async (request, reply) => {
    await service.setScope(request.requireAuth().id, { projectId: request.params.projectId, connectionId: request.body.connectionId, buildingId: request.body.buildingId });
    return reply.status(204).send();
  });
  fastify.post<{ Params: { projectId: string }; Body: MessagingDraftInput }>("/messaging-agent/projects/:projectId/proposals", {
    schema: { params: schemas.projectParams, body: schemas.draftBody, response: { 200: schemas.draftResponse } },
    config: { rateLimit: { max: 20, timeWindow: 60_000 } },
  }, (request) => service.propose(request.requireAuth().id, request.params.projectId, request.body.connectionId, request.body.text));
  fastify.post<{ Params: { projectId: string; messageId: string } }>("/messaging-agent/projects/:projectId/messages/:messageId/retry", {
    schema: { params: schemas.messageParams }, config: { rateLimit: { max: 10, timeWindow: 60_000 } },
  }, async (request, reply) => {
    const userId = request.requireAuth().id;
    requireMessagingEnabled(adapters);
    await messagingAgentRecoveryService(fastify.db, adapters).retry(userId, request.params.projectId, request.params.messageId);
    return reply.status(204).send();
  });
  fastify.patch<{ Params: { projectId: string; proposalId: string }; Body: Required<MessagingReviewInput> }>("/messaging-agent/projects/:projectId/proposals/:proposalId", {
    schema: { params: schemas.proposalParams, body: schemas.editBody, response: { 200: schemas.proposalResponse } },
  }, (request) => {
    const userId = request.requireAuth().id;
    requireMessagingEnabled(adapters);
    return service.edit(userId, request.params.projectId, request.params.proposalId, request.body.version, request.body.actions);
  });
  for (const operation of ["confirm", "cancel"] as const) {
    fastify.post<{ Params: { projectId: string; proposalId: string }; Body: MessagingReviewInput }>(`/messaging-agent/projects/:projectId/proposals/:proposalId/${operation}`, {
      schema: { params: schemas.proposalParams, body: schemas.confirmBody, response: { 200: schemas.proposalResponse } },
    }, (request) => {
      const userId = request.requireAuth().id;
      requireMessagingEnabled(adapters);
      return service[operation](userId, request.params.projectId, request.params.proposalId, request.body.version);
    });
  }
};

export default messagingAgentRoutes;
