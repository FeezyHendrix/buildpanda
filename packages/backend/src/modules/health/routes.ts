import type { FastifyPluginAsync } from "fastify";
import { config } from "../../config/index.ts";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/healthz", async (_request, reply) => {
    try {
      await fastify.db.raw("SELECT 1");
      return reply.send({ status: "ok", timestamp: Date.now() });
    } catch {
      return reply.status(503).send({ status: "unhealthy" });
    }
  });

  if (config.sentry.enabled) {
    fastify.get("/debug-sentry", async () => {
      throw new Error("Sentry test error from /debug-sentry");
    });
  }
};

export default healthRoutes;
