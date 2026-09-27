import type { FastifyPluginAsync } from "fastify";
import { preconRepository } from "./repository.ts";
import { sheetGeometryService } from "./sheet-geometry.ts";
import type { preconService } from "./service.ts";
import type { RoomAtBody, SymbolMatchesBody } from "./types.ts";

const sheetParams = {
  type: "object",
  required: ["sheetId"],
  additionalProperties: false,
  properties: { sheetId: { type: "string", minLength: 1 } },
} as const;

const roomAtBody = {
  type: "object",
  required: ["x", "y"],
  additionalProperties: false,
  properties: { x: { type: "number" }, y: { type: "number" } },
} as const;

const symbolMatchesBody = {
  type: "object",
  required: ["rect"],
  additionalProperties: false,
  properties: {
    rect: { type: "array", minItems: 4, maxItems: 4, items: { type: "number" } },
    excludeSeed: { type: "boolean" },
  },
} as const;

const points = { type: "array", items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } } } as const;

const roomAtResponse = {
  200: {
    type: "object",
    properties: { vertices: points, label: { type: ["string", "null"] }, areaM2: { type: "number" } },
  },
} as const;

const symbolMatchesResponse = {
  200: {
    type: "object",
    properties: { points, name: { type: ["string", "null"] }, count: { type: "integer" } },
  },
} as const;

interface SheetGeometryRoutesOptions {
  service: ReturnType<typeof preconService>;
}

// Measuring aids that read the drawing's own vectors: the space around a
// click, and every symbol like the one in a box. Both are measuring, so they
// take the measure permission; the org check is the sheet's session.
export const sheetGeometryRoutes: FastifyPluginAsync<SheetGeometryRoutesOptions> = async (fastify, { service }) => {
  const geometry = sheetGeometryService(preconRepository(fastify.db));

  fastify.post<{ Params: { sheetId: string }; Body: RoomAtBody }>(
    "/precon/sheets/:sheetId/room-at",
    { schema: { params: sheetParams, body: roomAtBody, response: roomAtResponse } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "measure");
      await service.assertSheetOrg(request.params.sheetId, orgId);
      return geometry.roomAt(request.params.sheetId, request.body);
    },
  );

  fastify.post<{ Params: { sheetId: string }; Body: SymbolMatchesBody }>(
    "/precon/sheets/:sheetId/symbol-matches",
    { schema: { params: sheetParams, body: symbolMatchesBody, response: symbolMatchesResponse } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "measure");
      await service.assertSheetOrg(request.params.sheetId, orgId);
      return geometry.symbolMatches(request.params.sheetId, request.body);
    },
  );
};
