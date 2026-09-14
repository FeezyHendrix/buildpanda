import type { FastifyPluginAsync } from "fastify";
import type { preconService } from "./service.ts";
import { MEASURE_TOOLS } from "./types.ts";
import type { CreateMeasurementBody } from "./types.ts";

const sessionParams = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

const measurementBody = {
  type: "object",
  required: ["sheetId", "tool", "vertices", "description", "elementGroup"],
  additionalProperties: false,
  properties: {
    sheetId: { type: "string", minLength: 1 },
    tool: { type: "string", enum: MEASURE_TOOLS },
    vertices: {
      type: "array",
      minItems: 1,
      maxItems: 5000,
      items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
    },
    description: { type: "string", minLength: 1, maxLength: 500 },
    elementGroup: { type: "string", minLength: 1, maxLength: 120 },
    code: { type: "string", maxLength: 40 },
    unit: { type: "string", minLength: 1, maxLength: 12 },
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

interface ManualRoutesOptions {
  service: ReturnType<typeof preconService>;
}

// Lines drawn by a person, and the flat export of what was measured.
export const manualRoutes: FastifyPluginAsync<ManualRoutesOptions> = async (fastify, { service }) => {
  fastify.post<{ Params: { sessionId: string }; Body: CreateMeasurementBody }>(
    "/precon/sessions/:sessionId/measurements",
    { schema: { params: sessionParams, body: measurementBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "measure");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const result = await service.createMeasurement(request.params.sessionId, request.body, user.id);
      return reply.status(201).send(result);
    },
  );

  fastify.get<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/export.csv",
    { schema: { params: sessionParams } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const { fileName, csv } = await service.exportCsv(request.params.sessionId);
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="${fileName}"`)
        .send(csv);
    },
  );
};
