import type { FastifyPluginAsync } from "fastify";
import type { preconService } from "./service.ts";

const sessionParams = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

const focusBody = {
  type: "object",
  required: ["rowId"],
  additionalProperties: false,
  properties: { rowId: { type: ["string", "null"], maxLength: 100 } },
} as const;

const presenceResponse = {
  type: "object",
  properties: {
    users: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" }, rowId: { type: ["string", "null"] } },
      },
    },
  },
} as const;

interface PresenceRoutesOptions {
  service: ReturnType<typeof preconService>;
}

// Which bill line the caller is on, shared with everyone else on the session.
// Presence itself comes from the websocket subscription; this only moves the
// caller's focus and republishes. A caller with no live socket is not on the
// session, so their focus has nowhere to show and the list comes back as is.
export const presenceRoutes: FastifyPluginAsync<PresenceRoutesOptions> = async (fastify, { service }) => {
  fastify.post<{ Params: { sessionId: string }; Body: { rowId: string | null } }>(
    "/precon/sessions/:sessionId/focus",
    { schema: { params: sessionParams, body: focusBody, response: { 200: presenceResponse } } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const channelId = `precon:${request.params.sessionId}`;
      const users = fastify.realtime.presence.focus(channelId, user.id, request.body.rowId);
      if (users) fastify.realtime.publishPresence(channelId, users);
      return { users: fastify.realtime.presence.list(channelId) };
    },
  );
};
