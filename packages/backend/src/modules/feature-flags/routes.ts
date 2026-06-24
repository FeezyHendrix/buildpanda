import type { FastifyPluginAsync } from "fastify";
import { featureFlagsRepository } from "./repository.ts";
import { featureFlagsService } from "./service.ts";
import type { FeatureFlagMap } from "./types.ts";

const updateBody = {
  type: "object",
  required: ["flags"],
  additionalProperties: false,
  properties: {
    flags: {
      type: "object",
      additionalProperties: { type: "boolean" },
    },
  },
} as const;

interface UpdateBody {
  flags: FeatureFlagMap;
}

const featureFlagRoutes: FastifyPluginAsync = async (fastify) => {
  const service = featureFlagsService(featureFlagsRepository(fastify.db));

  fastify.get("/feature-flags", async () => service.getSettings());

  fastify.get("/admin/feature-flags", async (request) => {
    request.requireAdmin();
    return service.getSettings();
  });

  fastify.patch<{ Body: UpdateBody }>(
    "/admin/feature-flags",
    { schema: { body: updateBody } },
    async (request) => {
      const admin = request.requireAdmin();
      return service.update(request.body.flags, { id: admin.id, name: admin.name });
    },
  );
};

export default featureFlagRoutes;
