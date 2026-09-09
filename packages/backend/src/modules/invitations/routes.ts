import type { FastifyPluginAsync } from "fastify";
import { publicTokenRateLimit } from "../../plugins/security.ts";
import { invitationsRepository } from "./repository.ts";
import { invitationsService } from "./service.ts";

// Public on purpose: the person these serve was invited by email and has no
// account yet, so there is no session to require. The opaque invitation id is
// the credential, exactly like a password-reset token — which is also why both
// routes carry the tighter unauthenticated rate limit.

const idParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1, maxLength: 200 } },
} as const;

// Doubles as an allowlist: inviterId and the rest of the row cannot leak.
const publicInvitationResponse = {
  200: {
    type: "object",
    properties: {
      organizationName: { type: "string" },
      email: { type: "string" },
      role: { type: "string" },
      status: { type: "string" },
    },
  },
} as const;

const invitationRoutes: FastifyPluginAsync = async (fastify) => {
  const service = invitationsService(invitationsRepository(fastify.db));

  fastify.get<{ Params: { id: string } }>(
    "/invitations/:id",
    {
      schema: { params: idParams, response: publicInvitationResponse },
      config: { rateLimit: publicTokenRateLimit },
    },
    async (request) => service.getPublic(request.params.id),
  );

  fastify.post<{ Params: { id: string } }>(
    "/invitations/:id/decline",
    {
      schema: {
        params: idParams,
        response: { 200: { type: "object", properties: { ok: { type: "boolean" } } } },
      },
      config: { rateLimit: publicTokenRateLimit },
    },
    async (request) => service.decline(request.params.id),
  );
};

export default invitationRoutes;
