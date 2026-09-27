import type { FastifyPluginAsync } from "fastify";
import { editorService } from "./editor-service.ts";
import { lockedPreconService } from "./locked-service.ts";
import type { PublishFn, preconService } from "./service.ts";
import type {
  CreateBillBody,
  CreateRowBody,
  EditDepthBody,
  EditHeightBody,
  EditTypicalBody,
  UpdateBillBody,
  UpdateRowBody,
} from "./types.ts";
import {
  billBody,
  billParams,
  createRowBody,
  editDepthBody,
  editHeightBody,
  editTypicalBody,
  rowParams,
  sessionParams,
  updateRowBody,
  versionOnlyBody,
} from "./route-schemas.ts";

interface RowRoutesOptions {
  service: ReturnType<typeof preconService>;
  publish: PublishFn;
}

// The bill and the lines in it: adding, renaming and removing a bill, then
// creating, editing, verifying, rejecting and deleting a single line.
export const rowRoutes: FastifyPluginAsync<RowRoutesOptions> = async (fastify, { service, publish }) => {
  const editor = editorService(fastify.db, publish);
  // Every state-changing line write below runs inside the session lock, so it
  // cannot interleave with an editor operation on the same bill.
  const locked = lockedPreconService(fastify.db, publish);

  fastify.post<{ Params: { sessionId: string }; Body: CreateBillBody }>(
    "/precon/sessions/:sessionId/bills",
    { schema: { params: sessionParams, body: billBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const bill = await locked.forSession(request.params.sessionId, (api) => api.createBill(request.params.sessionId, request.body.title, user.id));
      return reply.status(201).send(bill);
    },
  );

  fastify.patch<{ Params: { billId: string }; Body: UpdateBillBody }>(
    "/precon/bills/:billId",
    { schema: { params: billParams, body: billBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertBillOrg(request.params.billId, orgId);
      return locked.forBill(request.params.billId, (api) => api.renameBill(request.params.billId, request.body.title, user.id));
    },
  );

  fastify.delete<{ Params: { billId: string } }>(
    "/precon/bills/:billId",
    { schema: { params: billParams } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertBillOrg(request.params.billId, orgId);
      return locked.forBill(request.params.billId, (api) => api.removeBill(request.params.billId, user.id));
    },
  );

  fastify.post<{ Params: { billId: string }; Body: CreateRowBody }>(
    "/precon/bills/:billId/rows",
    { schema: { params: billParams, body: createRowBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertBillOrg(request.params.billId, orgId);
      const row = await locked.forBill(request.params.billId, (api) => api.createRow(request.params.billId, request.body, user.id));
      return reply.status(201).send(row);
    },
  );

  fastify.delete<{ Params: { rowId: string } }>(
    "/precon/rows/:rowId",
    { schema: { params: rowParams } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return locked.forRow(request.params.rowId, (api) => api.removeRow(request.params.rowId, user.id));
    },
  );

  fastify.patch<{ Params: { rowId: string }; Body: UpdateRowBody }>(
    "/precon/rows/:rowId",
    { schema: { params: rowParams, body: updateRowBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return locked.forRow(request.params.rowId, (api) => api.updateRow(request.params.rowId, request.body, user.id));
    },
  );

  // A storey height, a slab depth or a typical count is corrected without
  // redrawing: the server re-measures the line's own stored shape through the
  // new factor, so the drawing that was signed off is the drawing still billed.
  fastify.patch<{ Params: { rowId: string }; Body: EditHeightBody }>(
    "/precon/rows/:rowId/height",
    { schema: { params: rowParams, body: editHeightBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return editor.editHeight(request.params.rowId, request.body, user.id);
    },
  );

  fastify.patch<{ Params: { rowId: string }; Body: EditDepthBody }>(
    "/precon/rows/:rowId/depth",
    { schema: { params: rowParams, body: editDepthBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return editor.editDepth(request.params.rowId, request.body, user.id);
    },
  );

  fastify.patch<{ Params: { rowId: string }; Body: EditTypicalBody }>(
    "/precon/rows/:rowId/typical",
    { schema: { params: rowParams, body: editTypicalBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return editor.editTypical(request.params.rowId, request.body, user.id);
    },
  );

  // Correcting a figure and signing it off in one gesture is both acts at
  // once, so it needs both grants: an edit-only user may save, never verify.
  fastify.patch<{ Params: { rowId: string }; Body: UpdateRowBody }>(
    "/precon/rows/:rowId/save-and-verify",
    { schema: { params: rowParams, body: updateRowBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      request.requireOrgPermission("takeoffs", "verify");
      await service.assertRowOrg(request.params.rowId, orgId);
      return editor.saveAndVerify(request.params.rowId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { rowId: string }; Body: { version: number } }>(
    "/precon/rows/:rowId/verify",
    { schema: { params: rowParams, body: versionOnlyBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "verify");
      await service.assertRowOrg(request.params.rowId, orgId);
      return locked.forRow(request.params.rowId, (api) => api.verifyRow(request.params.rowId, request.body.version, user.id));
    },
  );

  fastify.post<{ Params: { rowId: string }; Body: { version: number } }>(
    "/precon/rows/:rowId/reject",
    { schema: { params: rowParams, body: versionOnlyBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "verify");
      await service.assertRowOrg(request.params.rowId, orgId);
      return locked.forRow(request.params.rowId, (api) => api.rejectRow(request.params.rowId, request.body.version, user.id));
    },
  );
};
