import type { FastifyPluginAsync } from "fastify";
import { notificationsRepository } from "./repository.ts";
import { notificationsService } from "./service.ts";

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    unreadOnly: { type: "boolean" },
    limit: { type: "integer", minimum: 1, maximum: 200 },
  },
} as const;

const notificationIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
  },
} as const;

const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  const service = notificationsService(notificationsRepository(fastify.db));

  fastify.get<{ Querystring: { unreadOnly?: boolean; limit?: number } }>(
    "/notifications",
    { schema: { querystring: listQuery } },
    async (request) => {
      const user = request.requireAuth();
      return service.list(user.id, {
        ...(request.query.unreadOnly !== undefined
          ? { unreadOnly: request.query.unreadOnly }
          : {}),
        ...(request.query.limit !== undefined
          ? { limit: request.query.limit }
          : {}),
      });
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/notifications/:id/read",
    { schema: { params: notificationIdParams } },
    async (request) => {
      const user = request.requireAuth();
      return service.markRead(user.id, request.params.id);
    },
  );

  fastify.post(
    "/notifications/read-all",
    async (request) => {
      const user = request.requireAuth();
      return service.markAllRead(user.id);
    },
  );
};

export default notificationRoutes;
