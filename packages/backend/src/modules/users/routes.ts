import type { FastifyPluginAsync } from "fastify";
import { usersRepository } from "./repository.ts";
import { usersService } from "./service.ts";

const idParamsSchema = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const userRoutes: FastifyPluginAsync = async (fastify) => {
  const service = usersService(usersRepository(fastify.db));

  fastify.get("/users", async (request) => {
    request.requireAuth();
    return service.list();
  });

  fastify.get<{ Params: { id: string } }>(
    "/users/:id",
    { schema: { params: idParamsSchema } },
    async (request) => {
      request.requireAuth();
      return service.getById(request.params.id);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/users/:id",
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      request.requireAuth();
      await service.delete(request.params.id);
      return reply.status(204).send();
    },
  );
};

export default userRoutes;
