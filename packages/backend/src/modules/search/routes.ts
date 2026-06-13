import type { FastifyPluginAsync } from "fastify";
import { searchRepository } from "./repository.ts";
import { searchService } from "./service.ts";

const searchQuery = {
  type: "object",
  required: ["q"],
  additionalProperties: false,
  properties: {
    q: { type: "string", minLength: 1, maxLength: 100 },
    limit: { type: "integer", minimum: 1, maximum: 25 },
  },
} as const;

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  const service = searchService(searchRepository(fastify.db));

  fastify.get<{ Querystring: { q: string; limit?: number } }>(
    "/search",
    { schema: { querystring: searchQuery } },
    async (request) => {
      const user = request.requireAuth();
      return service.search(user.id, {
        query: request.query.q,
        orgIds: [...request.orgRoles.keys()],
        participantProjectIds: [...request.projectRoles.keys()],
        ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
      });
    },
  );
};

export default searchRoutes;
