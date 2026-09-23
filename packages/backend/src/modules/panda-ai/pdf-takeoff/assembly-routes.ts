import type { FastifyPluginAsync } from "fastify";
import { editorOperationService } from "./editor-operation-service.ts";
import { grantsOf } from "./editor-grants.ts";
import type { PreconRepository } from "./repository.ts";
import type { PublishFn, preconService } from "./service.ts";
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
    operationId: { type: "string", minLength: 1, maxLength: 64 },
  },
} as const;

interface AssemblyRoutesOptions {
  service: ReturnType<typeof preconService>;
  repo: PreconRepository;
  publish: PublishFn;
}

// One drawn shape billed as every item of a rate-library assembly.
export const assemblyMeasurementRoutes: FastifyPluginAsync<AssemblyRoutesOptions> = async (fastify, { service, publish }) => {
  // The shipped URL is kept as an adapter onto the envelope: the same request
  // body, the same response, but now one receipt that the history can undo.
  const operations = editorOperationService(fastify.db, publish);

  fastify.post<{ Params: { sessionId: string }; Body: CreateAssemblyMeasurementBody }>(
    "/precon/sessions/:sessionId/measurements/assembly",
    { schema: { params: sessionParams, body: assemblyMeasurementBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "measure");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const result = await operations.apply(
        request.params.sessionId,
        {
          operationId: request.body.operationId ?? `pop_${request.id}`,
          command: {
            kind: "create-assembly",
            sheetId: request.body.sheetId,
            assemblyId: request.body.assemblyId,
            tool: request.body.tool,
            vertices: request.body.vertices,
            ...(request.body.elementGroup ? { elementGroup: request.body.elementGroup } : {}),
            ...(request.body.code ? { code: request.body.code } : {}),
            ...(request.body.factor ? { factor: request.body.factor } : {}),
            ...(request.body.typical !== undefined ? { typical: request.body.typical } : {}),
            ...(request.body.rate !== undefined ? { rate: request.body.rate } : {}),
            ...(request.body.billId ? { billId: request.body.billId } : {}),
          },
        },
        user.id,
        grantsOf(request, orgId),
      );
      return reply.status(201).send(result);
    },
  );
};
