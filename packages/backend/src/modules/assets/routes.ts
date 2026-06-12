import type { FastifyInstance } from "fastify";
import { emailLogoPng } from "../../lib/email-assets.ts";

/**
 * Public static assets referenced from transactional emails. Email clients
 * fetch these anonymously, so no auth — and aggressive caching is fine since
 * the asset is versioned with the build.
 */
export default async function assetRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get("/static/email-logo.png", async (_request, reply) => {
    return reply
      .header("Content-Type", "image/png")
      .header("Cache-Control", "public, max-age=86400, immutable")
      .send(emailLogoPng);
  });
}
