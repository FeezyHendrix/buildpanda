import type { FastifyPluginAsync } from "fastify";
import { PRECON_GENERATE_QUEUE, type PreconGenerateJobData } from "./job.ts";
import type { preconService } from "./service.ts";
import { DIM_UNITS, FOUNDATION_TYPES, SHEET_KINDS, STRUCTURAL_SYSTEMS, STRUCTURE_CLASSES } from "./types.ts";
import type { UpdateSheetBody, UpdateStructureBody } from "./types.ts";

const sessionParams = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

const sheetParams = {
  type: "object",
  required: ["sheetId"],
  additionalProperties: false,
  properties: { sheetId: { type: "string", minLength: 1 } },
} as const;

const updateSheetBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: SHEET_KINDS },
    title: { type: ["string", "null"], maxLength: 200 },
    scaleMmPerPt: { type: ["number", "null"], exclusiveMinimum: 0 },
    dimUnit: { type: ["string", "null"], enum: [...DIM_UNITS, null] },
  },
} as const;

const updateStructureBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    structureClass: { type: "string", enum: STRUCTURE_CLASSES },
    buildingType: { type: ["string", "null"], maxLength: 80 },
    storeys: { type: ["integer", "null"], minimum: 0, maximum: 200 },
    structuralSystem: { type: "string", enum: STRUCTURAL_SYSTEMS },
    foundationType: { type: "string", enum: FOUNDATION_TYPES },
  },
} as const;


interface ReviewRoutesOptions {
  service: ReturnType<typeof preconService>;
}

// Reviewer corrections to what the engine read: sheet type/title/scale, the
// structure reading, and the re-runs those corrections call for.
export const reviewRoutes: FastifyPluginAsync<ReviewRoutesOptions> = async (fastify, { service }) => {
  // Reviewer corrections to what the engine read off a sheet.
  fastify.patch<{ Params: { sheetId: string }; Body: UpdateSheetBody }>(
    "/precon/sheets/:sheetId",
    { schema: { params: sheetParams, body: updateSheetBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSheetOrg(request.params.sheetId, orgId);
      return service.updateSheet(request.params.sheetId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { sheetId: string } }>(
    "/precon/sheets/:sheetId/remeasure",
    { schema: { params: sheetParams } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "measure");
      await service.assertSheetOrg(request.params.sheetId, orgId);
      const sessionId = await service.assertRemeasurable(request.params.sheetId);
      const jobData: PreconGenerateJobData = { sessionId, orgId, mode: "remeasure", sheetId: request.params.sheetId };
      await fastify.queue.enqueue(PRECON_GENERATE_QUEUE, "remeasure", jobData);
      return reply.status(202).send({ status: "queued" });
    },
  );

  fastify.patch<{ Params: { sessionId: string }; Body: UpdateStructureBody }>(
    "/precon/sessions/:sessionId/structure",
    { schema: { params: sessionParams, body: updateStructureBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return service.updateStructure(request.params.sessionId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/redraft-bill",
    { schema: { params: sessionParams } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "measure");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      await service.assertRedraftable(request.params.sessionId);
      const jobData: PreconGenerateJobData = { sessionId: request.params.sessionId, orgId, mode: "redraft" };
      await fastify.queue.enqueue(PRECON_GENERATE_QUEUE, "redraft", jobData);
      return reply.status(202).send({ status: "queued" });
    },
  );

};
