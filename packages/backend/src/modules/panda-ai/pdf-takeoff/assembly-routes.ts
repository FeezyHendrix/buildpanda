import type { FastifyPluginAsync } from "fastify";
import { assemblyService } from "../../rate-library/assembly-service.ts";
import { rateLibraryRepository } from "../../rate-library/repository.ts";
import { assemblyMeasurement } from "./assembly-measure.ts";
import type { PreconRepository } from "./repository.ts";
import type { preconService } from "./service.ts";
import { MEASURE_TOOLS } from "./types.ts";
import type { CreateAssemblyMeasurementBody } from "./types.ts";

const sessionParams = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

// CreateMeasurementBody without description/unit (the assembly's items carry
// those), plus the assembly to bill it as.
const assemblyMeasurementBody = {
  type: "object",
  required: ["assemblyId", "sheetId", "tool", "vertices"],
  additionalProperties: false,
  properties: {
    assemblyId: { type: "string", minLength: 1 },
    sheetId: { type: "string", minLength: 1 },
    tool: { type: "string", enum: MEASURE_TOOLS },
    vertices: {
      type: "array",
      minItems: 1,
      maxItems: 5000,
      items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
    },
    elementGroup: { type: "string", minLength: 1, maxLength: 120 },
    code: { type: "string", maxLength: 40 },
    factor: {
      type: "object",
      additionalProperties: false,
      properties: {
        heightM: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
        depthM: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
      },
    },
    typical: { type: "integer", minimum: 1, maximum: 500 },
    rate: { type: "number", minimum: 0 },
    billId: { type: "string", minLength: 1 },
  },
} as const;

interface AssemblyRoutesOptions {
  service: ReturnType<typeof preconService>;
  repo: PreconRepository;
}

// One drawn shape billed as every item of a rate-library assembly.
export const assemblyMeasurementRoutes: FastifyPluginAsync<AssemblyRoutesOptions> = async (fastify, { service, repo }) => {
  const assemblies = assemblyService(rateLibraryRepository(fastify.db));
  const measure = assemblyMeasurement({ repo, manual: service.manualLine, loadAssembly: (orgId, id) => assemblies.priced(orgId, id) });

  fastify.post<{ Params: { sessionId: string }; Body: CreateAssemblyMeasurementBody }>(
    "/precon/sessions/:sessionId/measurements/assembly",
    { schema: { params: sessionParams, body: assemblyMeasurementBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "measure");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const result = await measure.create(request.params.sessionId, orgId, request.body, user.id);
      return reply.status(201).send(result);
    },
  );
};
