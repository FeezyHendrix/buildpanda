import type { FastifyPluginAsync } from "fastify";
import { auth } from "../lib/auth.js";

interface UserRow {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

async function getSession(request: { headers: Record<string, string | string[] | undefined> }) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) {
      headers.append(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }
  return auth.api.getSession({ headers });
}

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/users", async (request, reply) => {
    const session = await getSession(request);
    if (!session) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const users = await fastify.db<UserRow>("user").select(
      "id", "name", "email", "createdAt", "updatedAt"
    );
    return reply.send(users);
  });

  fastify.get<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
    const session = await getSession(request);
    if (!session) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const user = await fastify.db<UserRow>("user")
      .where("id", request.params.id)
      .select("id", "name", "email", "createdAt", "updatedAt")
      .first();

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }
    return reply.send(user);
  });

  fastify.delete<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
    const session = await getSession(request);
    if (!session) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const deleted = await fastify.db("user")
      .where("id", request.params.id)
      .del();

    if (!deleted) {
      return reply.status(404).send({ error: "User not found" });
    }
    return reply.status(204).send();
  });
};

export default userRoutes;
