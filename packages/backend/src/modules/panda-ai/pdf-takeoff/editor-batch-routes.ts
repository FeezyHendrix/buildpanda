import type { FastifyPluginAsync } from "fastify";
import { NotFoundError } from "../../../lib/errors.ts";
import { batchEditorService } from "./editor-service.ts";
import { preconGeometryRepository } from "./geometry-repository.ts";
import type { PublishFn, preconService } from "./service.ts";
import type {
  DuplicateGeometryBody,
  MergeGeometriesBody,
  ReassignGeometryBody,
  RemoveSegmentBody,
  SplitPolylineBody,
} from "./types.ts";
import { rowParams, sessionParams } from "./route-schemas.ts";
import {
  duplicateGeometryBody,
  duplicateGeometryResponse,
  geometryParams,
  mergeGeometriesBody,
  mergeGeometriesResponse,
  reassignGeometryBody,
  reassignGeometryResponse,
  removeSegmentQuery,
  rowResponse,
  rowSegmentParams,
  splitPolylineBody,
  splitPolylineResponse,
} from "./editor-batch-schemas.ts";

interface EditorBatchRoutesOptions {
  service: ReturnType<typeof preconService>;
  publish: PublishFn;
}

// Restructuring a take-off: cutting a run in two, trimming a side off it,
// copying a line, merging areas into one and moving a drawing to another line.
// Every one of them is an edit to the bill, so each needs the edit grant and
// the organization check before it reaches the session lock.
export const editorBatchRoutes: FastifyPluginAsync<EditorBatchRoutesOptions> = async (fastify, { service, publish }) => {
  const editor = batchEditorService(fastify.db, publish);
  const geometries = preconGeometryRepository(fastify.db);

  fastify.post<{ Params: { rowId: string }; Body: SplitPolylineBody }>(
    "/precon/rows/:rowId/split",
    { schema: { params: rowParams, body: splitPolylineBody, response: splitPolylineResponse } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return editor.splitPolyline(request.params.rowId, request.body, user.id);
    },
  );

  fastify.delete<{ Params: { rowId: string; segmentIndex: number }; Querystring: RemoveSegmentBody }>(
    "/precon/rows/:rowId/segments/:segmentIndex",
    { schema: { params: rowSegmentParams, querystring: removeSegmentQuery, response: rowResponse } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return editor.removeSegment(request.params.rowId, request.params.segmentIndex, request.query, user.id);
    },
  );

  fastify.post<{ Params: { rowId: string }; Body: DuplicateGeometryBody }>(
    "/precon/rows/:rowId/duplicate",
    { schema: { params: rowParams, body: duplicateGeometryBody, response: duplicateGeometryResponse } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return editor.duplicateGeometry(request.params.rowId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { sessionId: string }; Body: MergeGeometriesBody }>(
    "/precon/sessions/:sessionId/merge",
    { schema: { params: sessionParams, body: mergeGeometriesBody, response: mergeGeometriesResponse } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return editor.mergeGeometries(request.params.sessionId, request.body, user.id);
    },
  );

  // The drawing names the line it is billed on, so the organization check runs
  // against that line — never against the target the caller asked for.
  fastify.post<{ Params: { geometryId: string }; Body: ReassignGeometryBody }>(
    "/precon/geometries/:geometryId/reassign",
    { schema: { params: geometryParams, body: reassignGeometryBody, response: reassignGeometryResponse } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      const geometry = await geometries.geometryById(request.params.geometryId);
      if (!geometry) throw new NotFoundError("Geometry");
      await service.assertRowOrg(geometry.row_id, orgId);
      return editor.reassignGeometry(request.params.geometryId, request.body, user.id);
    },
  );
};
