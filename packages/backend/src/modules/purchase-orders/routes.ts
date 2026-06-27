import type { FastifyPluginAsync } from "fastify";
import { assertProjectPermission } from "../../lib/authorization.ts";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { purchaseOrdersRepository } from "./repository.ts";
import {
  purchaseOrdersService,
  type CreatePurchaseOrderInput,
  type EditPurchaseOrderInput,
} from "./service.ts";
import { PURCHASE_ORDER_STATUSES } from "./types.ts";

const purchaseOrderParams = {
  type: "object",
  required: ["id", "purchaseOrderId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    purchaseOrderId: { type: "string", minLength: 1 },
  },
} as const;

const statusSchema = {
  type: "string",
  enum: PURCHASE_ORDER_STATUSES,
} as const;

const lineItemSchema = {
  type: "object",
  required: ["description"],
  additionalProperties: false,
  properties: {
    description: { type: "string", minLength: 1, maxLength: 500 },
    quantity: { type: "number", exclusiveMinimum: 0 },
    unitPrice: { type: "number", minimum: 0 },
  },
} as const;

const createPurchaseOrderBody = {
  type: "object",
  required: ["poNumber", "vendorName", "items"],
  additionalProperties: false,
  properties: {
    poNumber: { type: "string", minLength: 1, maxLength: 100 },
    vendorName: { type: "string", minLength: 1, maxLength: 200 },
    status: statusSchema,
    orderDate: { type: "string", maxLength: 30 },
    expectedDate: { type: "string", maxLength: 30 },
    notes: { type: "string", maxLength: 2000 },
    items: { type: "array", minItems: 1, items: lineItemSchema },
  },
} as const;

const editPurchaseOrderBody = {
  type: "object",
  required: ["items"],
  additionalProperties: false,
  properties: createPurchaseOrderBody.properties,
} as const;

function requiresFinanceApproval(status: string | undefined | null): boolean {
  return status === "Issued" || status === "Received" || status === "Closed";
}

const purchaseOrderRoutes: FastifyPluginAsync = async (fastify) => {
  const service = purchaseOrdersService(purchaseOrdersRepository(fastify.db));

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/purchase-orders",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.listByProject(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreatePurchaseOrderInput }>(
    "/projects/:id/purchase-orders",
    { schema: { params: projectIdParams, body: createPurchaseOrderBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      if (requiresFinanceApproval(request.body.status)) {
        assertProjectPermission(
          { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
          { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
          "finances", "approve",
        );
      }
      const purchaseOrder = await service.create(project.id, request.body);
      return reply.status(201).send(purchaseOrder);
    },
  );

  fastify.put<{
    Params: { id: string; purchaseOrderId: string };
    Body: EditPurchaseOrderInput;
  }>(
    "/projects/:id/purchase-orders/:purchaseOrderId",
    { schema: { params: purchaseOrderParams, body: editPurchaseOrderBody } },
    async (request) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      if (requiresFinanceApproval(request.body.status)) {
        assertProjectPermission(
          { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
          { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
          "finances", "approve",
        );
      }
      return service.edit(project.id, request.params.purchaseOrderId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; purchaseOrderId: string } }>(
    "/projects/:id/purchase-orders/:purchaseOrderId",
    { schema: { params: purchaseOrderParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      await service.remove(project.id, request.params.purchaseOrderId);
      return reply.status(204).send();
    },
  );
};

export default purchaseOrderRoutes;
