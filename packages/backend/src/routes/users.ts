import type { FastifyPluginAsync } from "fastify";

interface UserRow {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/users", async (_request, reply) => {
    const users = await fastify.db<UserRow>("users").select("*");
    return reply.send(users);
  });

  fastify.get<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
    const user = await fastify.db<UserRow>("users")
      .where("id", request.params.id)
      .first();

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }
    return reply.send(user);
  });

  fastify.post<{ Body: { name: string; email: string } }>("/users", async (request, reply) => {
    const { name, email } = request.body;
    const [user] = await fastify.db<UserRow>("users")
      .insert({ name, email })
      .returning("*");

    return reply.status(201).send(user);
  });

  fastify.delete<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
    const deleted = await fastify.db("users")
      .where("id", request.params.id)
      .del();

    if (!deleted) {
      return reply.status(404).send({ error: "User not found" });
    }
    return reply.status(204).send();
  });
};

export default userRoutes;
