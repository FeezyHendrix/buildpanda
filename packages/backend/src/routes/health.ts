import type { FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/healthz", async (_request, reply) => {
    try {
      await fastify.db.raw("SELECT 1");
      return reply.send({ status: "ok", timestamp: Date.now() });
    } catch {
      return reply.status(503).send({ status: "unhealthy" });
    }
  });
};

export default healthRoutes;
