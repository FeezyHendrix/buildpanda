import type { FastifyPluginAsync } from "fastify";
import { assertProjectPermission } from "../../lib/authorization.ts";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { stagesRepository } from "../stages/repository.ts";
import { buildMaterialsServices } from "../materials-equipment/wiring.ts";
import { logger } from "../../lib/logger.ts";
import { purchaseOrdersRepository } from "./repository.ts";
import { purchaseOrdersService } from "./service.ts";
import {
  cancelBody,
  createPurchaseOrderBody,
  editPurchaseOrderBody,
  issueBody,
  materialOrderParams,
  purchaseOrderParams,
  purchaseOrderResponse,
  raiseFromOrderBody,
  receiveBody,
} from "./schemas.ts";
import type {
  CancelPurchaseOrderInput,
  CreatePurchaseOrderInput,
  EditPurchaseOrderInput,
  IssuePurchaseOrderInput,
  RaiseFromMaterialOrderInput,
  ReceivePurchaseOrderInput,
} from "./types.ts";

const purchaseOrderRoutes: FastifyPluginAsync = async (fastify) => {
  const stages = stagesRepository(fastify.db);
  const procurement = buildMaterialsServices(fastify);
  const materials = procurement.service;
  const service = purchaseOrdersService(purchaseOrdersRepository(fastify.db), {
    stageBelongsToProject: async (projectId, stageId) =>
      (await stages.findById(stageId))?.project_id === projectId,
    // Issuing the PO places the order. If the material's approval is still
    // open the order stays where it is: the PO is finance's record, and the
    // approval gate is the materials team's to override, not finance's.
    materialOrderIssued: async (projectId, orderId, poNumber) => {
      const order = await materials.getMaterialOrder(projectId, orderId).catch(() => null);
      if (order?.status !== "Approved") return;
      await materials
        .updateMaterialOrder(projectId, orderId, { status: "Ordered", notes: [order.notes, `Ordered on ${poNumber}`].filter(Boolean).join("\n") })
        .catch((error: unknown) => logger.info({ err: error, projectId, orderId }, "Order left unplaced after PO issue"));
    },
    materialOrderReceived: async ({ projectId, orderId, quantity, receivedAt, poNumber, actorId }) => {
      // The PO receipt stands on its own; an order closed since cannot take
      // the goods, and that must not undo what finance recorded.
      await procurement.deliveries
        .record(
          projectId,
          orderId,
          { deliveredQty: quantity, deliveredAt: receivedAt, deliveryNote: poNumber, notes: `Received against ${poNumber}` },
          actorId,
        )
        .catch((error: unknown) => logger.warn({ err: error, projectId, orderId }, "PO receipt not recorded on its order"));
    },
  });

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/purchase-orders",
    {
      schema: {
        params: projectIdParams,
        response: { 200: { type: "array", items: purchaseOrderResponse } },
      },
    },
    async (request) => {
      // Committed vendor spend is the contractor's own cost position.
      const project = await request.requireProjectPermission(request.params.id, "finances", "viewCosts");
      return service.listByProject(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreatePurchaseOrderInput }>(
    "/projects/:id/purchase-orders",
    { schema: { params: projectIdParams, body: createPurchaseOrderBody, response: { 201: purchaseOrderResponse } } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      const purchaseOrder = await service.create(project.id, request.body);
      return reply.status(201).send(purchaseOrder);
    },
  );

  // Raising a PO from an approved material request is the link the two records
  // were missing: the PO carries the request's supplier, quantity and stage.
  fastify.post<{ Params: { id: string; orderId: string }; Body: RaiseFromMaterialOrderInput }>(
    "/projects/:id/materials/orders/:orderId/purchase-order",
    { schema: { params: materialOrderParams, body: raiseFromOrderBody, response: { 201: purchaseOrderResponse } } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      const order = await materials.getMaterialOrder(project.id, request.params.orderId);
      const purchaseOrder = await service.createFromMaterialOrder(
        project.id,
        {
          id: order.id,
          title: order.title,
          materialName: order.materialName,
          quantity: order.quantity,
          unit: order.unit,
          unitRate: order.unitRate,
          estimatedCost: order.estimatedCost,
          supplier: order.supplier,
          supplierId: order.supplierId,
          phaseId: order.phaseId,
          expectedDeliveryAt: order.expectedDeliveryAt,
          neededBy: order.neededBy,
        },
        request.body ?? {},
      );
      return reply.status(201).send(purchaseOrder);
    },
  );

  fastify.put<{ Params: { id: string; purchaseOrderId: string }; Body: EditPurchaseOrderInput }>(
    "/projects/:id/purchase-orders/:purchaseOrderId",
    { schema: { params: purchaseOrderParams, body: editPurchaseOrderBody, response: { 200: purchaseOrderResponse } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      return service.edit(project.id, request.params.purchaseOrderId, request.body);
    },
  );

  fastify.post<{ Params: { id: string; purchaseOrderId: string }; Body: IssuePurchaseOrderInput }>(
    "/projects/:id/purchase-orders/:purchaseOrderId/issue",
    { schema: { params: purchaseOrderParams, body: issueBody, response: { 200: purchaseOrderResponse } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      const user = request.requireAuth();
      assertProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
        "finances",
        "approve",
      );
      return service.issue(project.id, request.params.purchaseOrderId, request.body ?? {}, user.id);
    },
  );

  fastify.post<{ Params: { id: string; purchaseOrderId: string }; Body: ReceivePurchaseOrderInput }>(
    "/projects/:id/purchase-orders/:purchaseOrderId/receive",
    { schema: { params: purchaseOrderParams, body: receiveBody, response: { 200: purchaseOrderResponse } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      const user = request.requireAuth();
      assertProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
        "finances",
        "approve",
      );
      return service.receive(project.id, request.params.purchaseOrderId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { id: string; purchaseOrderId: string }; Body: CancelPurchaseOrderInput }>(
    "/projects/:id/purchase-orders/:purchaseOrderId/cancel",
    { schema: { params: purchaseOrderParams, body: cancelBody, response: { 200: purchaseOrderResponse } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      return service.cancel(project.id, request.params.purchaseOrderId, request.body);
    },
  );

  fastify.post<{ Params: { id: string; purchaseOrderId: string } }>(
    "/projects/:id/purchase-orders/:purchaseOrderId/close",
    { schema: { params: purchaseOrderParams, response: { 200: purchaseOrderResponse } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      const user = request.requireAuth();
      assertProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
        "finances",
        "approve",
      );
      return service.close(project.id, request.params.purchaseOrderId);
    },
  );

  fastify.delete<{ Params: { id: string; purchaseOrderId: string } }>(
    "/projects/:id/purchase-orders/:purchaseOrderId",
    { schema: { params: purchaseOrderParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      await service.remove(project.id, request.params.purchaseOrderId);
      return reply.status(204).send();
    },
  );
};

export default purchaseOrderRoutes;
