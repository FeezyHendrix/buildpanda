import type { FastifyPluginAsync } from "fastify";
import { maintenanceRepository } from "./repository.ts";
import { maintenanceService } from "./service.ts";

const updateBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    enabled: { type: "boolean" },
    message: { type: ["string", "null"], maxLength: 1000 },
  },
} as const;

interface UpdateBody {
  enabled?: boolean;
  message?: string | null;
}

const maintenanceRoutes: FastifyPluginAsync = async (fastify) => {
  const service = maintenanceService(maintenanceRepository(fastify.db));

  fastify.get("/maintenance", async (request) => {
    return service.getStatus(request.user?.role === "admin");
  });

  fastify.get("/admin/maintenance", async (request) => {
    request.requireAdmin();
    return service.getSettings();
  });

  fastify.patch<{ Body: UpdateBody }>(
    "/admin/maintenance",
    { schema: { body: updateBody } },
    async (request) => {
      const admin = request.requireAdmin();
      return service.update({
        enabled: request.body.enabled,
        message: request.body.message,
        updatedById: admin.id,
        updatedByName: admin.name,
      });
    },
  );
};

export default maintenanceRoutes;
