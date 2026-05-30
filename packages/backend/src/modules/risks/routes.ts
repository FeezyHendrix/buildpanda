import type { FastifyPluginAsync } from "fastify";
import { risksRepository } from "./repository.ts";
import { risksService } from "./service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const riskRoutes: FastifyPluginAsync = async (fastify) => {
  const service = risksService(risksRepository(fastify.db));

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/risk-factors",
    { schema: { params: projectIdParams } },
    async (request) => {
      request.requireAuth();
      return service.listByProject(request.params.id);
    },
  );
};

export default riskRoutes;
