import type { FastifyPluginAsync } from "fastify";
import { NotFoundError } from "../../../lib/errors.ts";
import { editorService } from "./editor-service.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import { grantsOf } from "./editor-grants.ts";
import type { PublishFn, preconService } from "./service.ts";
import type { AddDeductionBody, EditDeductionBody, RemoveDeductionBody, UpdateGeometryBody } from "./types.ts";
import {
  addDeductionBody,
  editDeductionBody,
  removeDeductionQuery,
  rowDeductionParams,
  rowParams,
  updateGeometryBody,
} from "./route-schemas.ts";

interface GeometryRoutesOptions {
  service: ReturnType<typeof preconService>;
  publish: PublishFn;
}

// Re-measuring a line on a sheet. The client sends vertices only; the service
// recomputes the quantity from them at the sheet's scale. Both writes go
// through the editor's unit of work, so the row, its geometry and the audit
// entry land together or not at all.
export const geometryRoutes: FastifyPluginAsync<GeometryRoutesOptions> = async (fastify, { service, publish }) => {
  const editor = editorService(fastify.db, publish);
  // The shipped deduction routes now delegate into the operation envelope rather
  // than a second pooled writer, so an opening taken out through the old URL gets
  // the same receipt — and the same undo — as one taken out through the editor.
  const operations = editorOperationService(fastify.db, publish);
  const sessionOf = async (rowId: string): Promise<string> => {
    const sessionId = await service.boundRepository.sessionIdForRow(rowId);
    if (!sessionId) throw new NotFoundError("BOQ row");
    return sessionId;
  };

  fastify.put<{ Params: { rowId: string }; Body: UpdateGeometryBody }>(
    "/precon/rows/:rowId/geometry",
    { schema: { params: rowParams, body: updateGeometryBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return editor.updateGeometry(request.params.rowId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { rowId: string }; Body: AddDeductionBody }>(
    "/precon/rows/:rowId/deductions",
    { schema: { params: rowParams, body: addDeductionBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return operations.apply(
        await sessionOf(request.params.rowId),
        {
          operationId: request.body.operationId ?? `pop_${request.id}`,
          command: {
            kind: "add-deduction",
            rowId: request.params.rowId,
            label: request.body.label,
            ...(request.body.vertices ? { vertices: request.body.vertices } : {}),
            ...(request.body.mode ? { mode: request.body.mode } : {}),
            ...(request.body.dimensions ? { dimensions: request.body.dimensions } : {}),
            ...(request.body.sheetId ? { sheetId: request.body.sheetId } : {}),
          },
        },
        user.id,
        grantsOf(request, orgId),
      );
    },
  );

  fastify.patch<{ Params: { rowId: string; geometryId: string }; Body: EditDeductionBody }>(
    "/precon/rows/:rowId/deductions/:geometryId",
    { schema: { params: rowDeductionParams, body: editDeductionBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return operations.apply(
        await sessionOf(request.params.rowId),
        {
          operationId: request.body.operationId ?? `pop_${request.id}`,
          command: {
            kind: "edit-deduction",
            rowId: request.params.rowId,
            geometryId: request.params.geometryId,
            ...(request.body.vertices ? { vertices: request.body.vertices } : {}),
            ...(request.body.dimensions ? { dimensions: request.body.dimensions } : {}),
          },
        },
        user.id,
        grantsOf(request, orgId),
      );
    },
  );

  fastify.delete<{ Params: { rowId: string; geometryId: string }; Querystring: RemoveDeductionBody }>(
    "/precon/rows/:rowId/deductions/:geometryId",
    { schema: { params: rowDeductionParams, querystring: removeDeductionQuery } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return operations.apply(
        await sessionOf(request.params.rowId),
        {
          operationId: request.query.operationId ?? `pop_${request.id}`,
          command: { kind: "remove-deduction", rowId: request.params.rowId, geometryId: request.params.geometryId },
        },
        user.id,
        grantsOf(request, orgId),
      );
    },
  );
};
