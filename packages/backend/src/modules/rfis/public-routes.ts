import type { FastifyPluginAsync } from "fastify";
import { rfisRepository } from "./repository.ts";
import { rfisService } from "./service.ts";

const tokenParams = {
  type: "object",
  properties: { token: { type: "string", minLength: 1 } },
  required: ["token"],
  additionalProperties: false,
} as const;

const replyBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 8000 } },
} as const;

const publicRfiRoutes: FastifyPluginAsync = async (fastify) => {
  const service = rfisService(rfisRepository(fastify.db));

  fastify.post<{ Params: { token: string }; Body: { body: string } }>(
    "/rfi-reply/:token",
    { schema: { params: tokenParams, body: replyBody } },
    async (request, reply) => {
      const result = await service.replyByToken(request.params.token, request.body.body);
      if (!result.ok) {
        return reply.status(410).send({
          accepted: false,
          reason: result.reason,
        });
      }
      return {
        accepted: true,
        rfiNumber: result.rfiNumber,
        rfiSubject: result.rfiSubject,
      };
    },
  );
};

export default publicRfiRoutes;
