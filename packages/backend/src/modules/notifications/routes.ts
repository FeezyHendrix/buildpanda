import type { FastifyPluginAsync } from "fastify";
import { notificationsRepository } from "./repository.ts";
import { notificationsService } from "./service.ts";
import { NOTIFICATION_TYPE_VALUES, type NotificationType } from "./types.ts";

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

const preferenceBody = {
  type: "object",
  required: ["type"],
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: NOTIFICATION_TYPE_VALUES },
    inAppEnabled: { type: "boolean" },
    emailEnabled: { type: "boolean" },
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

  fastify.get("/notifications/preferences", async (request) => {
    const user = request.requireAuth();
    return service.getPreferences(user.id);
  });

  fastify.put<{
    Body: { type: NotificationType; inAppEnabled?: boolean; emailEnabled?: boolean };
  }>(
    "/notifications/preferences",
    { schema: { body: preferenceBody } },
    async (request) => {
      const user = request.requireAuth();
      const { type, inAppEnabled, emailEnabled } = request.body;
      return service.setPreference(user.id, type, {
        ...(inAppEnabled !== undefined ? { inAppEnabled } : {}),
        ...(emailEnabled !== undefined ? { emailEnabled } : {}),
      });
    },
  );
};

export default notificationRoutes;
