import type { FastifyPluginAsync } from "fastify";
import { usersRepository } from "./repository.ts";
import { usersService } from "./service.ts";
import { idParams } from "../../lib/schemas.ts";

const userRoutes: FastifyPluginAsync = async (fastify) => {
  const service = usersService(usersRepository(fastify.db));

  fastify.get("/users", async (request) => {
    request.requireAdmin();
    return service.list();
  });

  fastify.get<{ Params: { id: string } }>(
    "/users/:id",
    { schema: { params: idParams } },
    async (request) => {
      request.requireAdmin();
      return service.getById(request.params.id);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/users/:id",
    { schema: { params: idParams } },
    async (request, reply) => {
      request.requireAdmin();
      await service.delete(request.params.id);
      return reply.status(204).send();
    },
  );
};

export default userRoutes;
