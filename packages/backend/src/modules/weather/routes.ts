import type { FastifyPluginAsync } from "fastify";
import { weatherService } from "./service.ts";

const projectIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const weatherRoutes: FastifyPluginAsync = async (fastify) => {
  const service = weatherService(fastify.db);

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/weather/current",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return { weather: await service.current(project.id) };
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/weather/forecast",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return (await service.forecast(project.id)) ?? { locationName: null, current: null, forecast: [] };
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/weather/analysis",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.analyze(project.id);
    },
  );
};

export default weatherRoutes;
