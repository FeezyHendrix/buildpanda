import type { FastifyPluginAsync } from "fastify";
import { pandaAiRepository } from "./repository.ts";
import { pandaAiService } from "./service.ts";
import { detectPhases } from "./phase-detection.ts";
import { materialsEquipmentRepository } from "../materials-equipment/repository.ts";
import { materialsEquipmentService } from "../materials-equipment/service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const pandaAiRoutes: FastifyPluginAsync = async (fastify) => {
  const service = pandaAiService(pandaAiRepository(fastify.db), fastify.queue);
  const materials = materialsEquipmentService(materialsEquipmentRepository(fastify.db));

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/ai/insights",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return { insight: await service.getLatest(project.id) };
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/projects/:id/ai/analyze",
    { schema: { params: projectIdParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      const insight = await service.trigger(project.id, user.id);
      return reply.status(202).send({ insight });
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/projects/:id/ai/detect-phases",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      const orders = await materials.listMaterialOrders(request.params.id);
      const materialNames = orders.map((order) => order.materialName).filter(Boolean);
      return detectPhases(project.name, materialNames);
    },
  );
};

export default pandaAiRoutes;
