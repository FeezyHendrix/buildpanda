import type { FastifyPluginAsync } from "fastify";
import { config } from "../../config/index.ts";
import { notificationsRepository } from "./repository.ts";
import { notificationsService, type PushSubscriptionInput } from "./service.ts";
import { isPushConfigured } from "./push-job.ts";
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

const pushPublicKeyResponse = {
  200: {
    type: "object",
    properties: {
      publicKey: { type: "string" },
    },
  },
} as const;

const pushSubscribeBody = {
  type: "object",
  required: ["endpoint", "keys"],
  additionalProperties: false,
  properties: {
    endpoint: { type: "string", minLength: 1 },
    keys: {
      type: "object",
      required: ["p256dh", "auth"],
      additionalProperties: false,
      properties: {
        p256dh: { type: "string", minLength: 1 },
        auth: { type: "string", minLength: 1 },
      },
    },
  },
} as const;

const pushUnsubscribeBody = {
  type: "object",
  required: ["endpoint"],
  additionalProperties: false,
  properties: {
    endpoint: { type: "string", minLength: 1 },
  },
} as const;

const okResponse = {
  200: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
    },
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

  // Empty string when VAPID keys are unconfigured — the frontend hides the
  // push toggle in that case.
  fastify.get(
    "/push/public-key",
    { schema: { response: pushPublicKeyResponse } },
    async (request) => {
      request.requireAuth();
      return { publicKey: isPushConfigured() ? config.push.vapidPublicKey : "" };
    },
  );

  fastify.post<{ Body: PushSubscriptionInput }>(
    "/push/subscriptions",
    { schema: { body: pushSubscribeBody, response: okResponse } },
    async (request) => {
      const user = request.requireAuth();
      await service.subscribePush(
        user.id,
        request.body,
        request.headers["user-agent"] ?? null,
      );
      return { ok: true };
    },
  );

  fastify.delete<{ Body: { endpoint: string } }>(
    "/push/subscriptions",
    { schema: { body: pushUnsubscribeBody, response: okResponse } },
    async (request) => {
      const user = request.requireAuth();
      await service.unsubscribePush(user.id, request.body.endpoint);
      return { ok: true };
    },
  );
};

export default notificationRoutes;
