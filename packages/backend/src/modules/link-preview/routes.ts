import type { FastifyPluginAsync } from "fastify";
import { linkPreviewRepository } from "./repository.ts";
import { linkPreviewService } from "./service.ts";

const previewBody = {
  type: "object",
  required: ["url"],
  additionalProperties: false,
  properties: {
    url: { type: "string", minLength: 1, maxLength: 2000 },
  },
} as const;

const linkPreviewRoutes: FastifyPluginAsync = async (fastify) => {
  const service = linkPreviewService(linkPreviewRepository(fastify.db));

  fastify.post<{ Body: { url: string } }>(
    "/link-preview",
    { schema: { body: previewBody } },
    async (request) => {
      request.requireAuth();
      const preview = await service.preview(request.body.url);
      return { preview };
    },
  );
};

export default linkPreviewRoutes;
