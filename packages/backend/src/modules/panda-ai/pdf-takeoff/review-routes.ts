import type { FastifyPluginAsync } from "fastify";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { NotFoundError, BadRequestError } from "../../../lib/errors.ts";
import { TAKEOFF_QUEUE, withTempDwg, type TakeoffJobData } from "../dwg-takeoff/job.ts";
import { parseDwgToJson } from "../dwg-takeoff/dwg.ts";
import { renderDwgSvg } from "../dwg-takeoff/svg.ts";
import { LAYER_ELEMENTS } from "../dwg-takeoff/types.ts";
import { PRECON_GENERATE_QUEUE, type PreconGenerateJobData } from "./job.ts";
import type { preconService } from "./service.ts";
import { DIM_UNITS, FOUNDATION_TYPES, SHEET_KINDS, STRUCTURAL_SYSTEMS, STRUCTURE_CLASSES } from "./types.ts";
import type { UpdateLayerMapBody, UpdateSheetBody, UpdateStructureBody } from "./types.ts";

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
    // a details sheet's regions at their own scale; rect in sheet points
    viewports: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["label", "rect", "scaleMmPerPt"],
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1, maxLength: 80 },
          label: { type: "string", minLength: 1, maxLength: 120 },
          rect: { type: "array", minItems: 4, maxItems: 4, items: { type: "number" } },
          scaleMmPerPt: { type: "number", exclusiveMinimum: 0 },
        },
      },
    },
  },
} as const;

// layer name → element; every value must be one the engine knows
const updateLayerMapBody = {
  type: "object",
  required: ["layerMap"],
  additionalProperties: false,
  properties: {
    layerMap: {
      type: "object",
      maxProperties: 500,
      additionalProperties: { type: "string", enum: LAYER_ELEMENTS },
    },
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

  // A DWG sheet is drawn from the same parse the engine measured, framed to
  // the drawing's own window of the model space. The SVG is cached on disk
  // per sheet: parsing a large model takes seconds, viewing it happens on
  // every visit.
  fastify.get<{ Params: { sheetId: string } }>(
    "/precon/sheets/:sheetId/svg",
    { schema: { params: sheetParams } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      const sheet = await service.getSheetForOrg(request.params.sheetId, orgId);
      if (!sheet) throw new NotFoundError("Sheet");
      if (!/\.dwg$/i.test(sheet.fileName)) throw new BadRequestError("Only DWG sheets render to SVG");
      const cacheDir = path.join(os.tmpdir(), "precon-dwg-svg");
      const cached = path.join(cacheDir, `${sheet.id}.svg`);
      let svg: string | null = await fs.readFile(cached, "utf8").catch(() => null);
      if (svg === null) {
        const rendered = await withTempDwg(sheet.storagePath, async (file) =>
          renderDwgSvg(await parseDwgToJson(file), { bounds: sheet.bounds ?? undefined }),
        );
        svg = rendered.svg;
        if (svg) {
          await fs.mkdir(cacheDir, { recursive: true });
          await fs.writeFile(cached, svg, "utf8").catch(() => undefined);
        }
      }
      if (!svg) throw new NotFoundError("Nothing drawable in this DWG's model space");
      return reply.header("content-type", "image/svg+xml").header("cache-control", "private, max-age=3600").send(svg);
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

  // The reviewer's layer map is stored on the session and the DWG is
  // measured again with it; the engine's unverified rows are replaced.
  fastify.patch<{ Params: { sessionId: string }; Body: UpdateLayerMapBody }>(
    "/precon/sessions/:sessionId/layer-map",
    { schema: { params: sessionParams, body: updateLayerMapBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const session = await service.updateLayerMap(request.params.sessionId, request.body, user.id);
      const jobData: TakeoffJobData = { sessionId: session.id, orgId, rerun: true };
      await fastify.queue.enqueue(TAKEOFF_QUEUE, "takeoff", jobData);
      return reply.status(202).send(session);
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
