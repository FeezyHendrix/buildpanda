import type { FastifyPluginAsync } from "fastify";
import { materialsEquipmentRepository } from "./repository.ts";
import {
  materialsEquipmentService,
  type CreateEquipmentRequestInput,
  type CreateMaterialOrderInput,
  type UpdateEquipmentRequestInput,
  type UpdateMaterialOrderInput,
} from "./service.ts";
import type { EquipmentBucket, MaterialOrderStatus } from "./types.ts";

const MATERIAL_STATUS = ["Draft", "Requested", "Approved", "Ordered", "PartiallyDelivered", "Delivered", "Cancelled"] as const;
const EQUIPMENT_STATUS = ["Draft", "Requested", "Approved", "Scheduled", "OnHire", "Returned", "Cancelled"] as const;
const PRIORITY = ["Low", "Normal", "High", "Critical"] as const;
const BUCKETS = ["requests", "approvals", "schedule", "on-hire", "returns"] as const;

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const materialParams = {
  type: "object",
  required: ["id", "orderId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    orderId: { type: "string", minLength: 1 },
  },
} as const;

const equipmentParams = {
  type: "object",
  required: ["id", "requestId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    requestId: { type: "string", minLength: 1 },
  },
} as const;

const materialQuery = {
  type: "object",
  additionalProperties: false,
  properties: { status: { type: "string", enum: MATERIAL_STATUS } },
} as const;

const equipmentQuery = {
  type: "object",
  additionalProperties: false,
  properties: { bucket: { type: "string", enum: BUCKETS } },
} as const;

const materialBody = {
  type: "object",
  required: ["title", "materialName", "quantity", "unit", "neededBy"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    materialName: { type: "string", minLength: 1, maxLength: 200 },
    quantity: { type: "number", exclusiveMinimum: 0 },
    unit: { type: "string", minLength: 1, maxLength: 40 },
    supplier: { type: ["string", "null"], maxLength: 200 },
    status: { type: "string", enum: MATERIAL_STATUS },
    priority: { type: "string", enum: PRIORITY },
    phaseId: { type: ["string", "null"], maxLength: 100 },
    activityId: { type: ["string", "null"], maxLength: 100 },
    documentId: { type: ["string", "null"], maxLength: 100 },
    neededBy: { type: "string", minLength: 1, maxLength: 40 },
    orderedAt: { type: ["string", "null"], maxLength: 40 },
    expectedDeliveryAt: { type: ["string", "null"], maxLength: 40 },
    deliveredAt: { type: ["string", "null"], maxLength: 40 },
    estimatedCost: { type: "number", minimum: 0 },
    actualCost: { type: "number", minimum: 0 },
    currency: { type: "string", enum: ["NGN", "USD"] },
    deliveryLocation: { type: ["string", "null"], maxLength: 200 },
    notes: { type: ["string", "null"], maxLength: 2000 },
  },
} as const;

const materialPatchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: materialBody.properties,
} as const;

const equipmentBody = {
  type: "object",
  required: ["title", "equipmentName", "equipmentType", "neededFrom", "neededUntil"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    equipmentName: { type: "string", minLength: 1, maxLength: 200 },
    equipmentType: { type: "string", minLength: 1, maxLength: 120 },
    quantity: { type: "integer", minimum: 1, maximum: 500 },
    supplier: { type: ["string", "null"], maxLength: 200 },
    status: { type: "string", enum: EQUIPMENT_STATUS },
    priority: { type: "string", enum: PRIORITY },
    phaseId: { type: ["string", "null"], maxLength: 100 },
    activityId: { type: ["string", "null"], maxLength: 100 },
    documentId: { type: ["string", "null"], maxLength: 100 },
    neededFrom: { type: "string", minLength: 1, maxLength: 40 },
    neededUntil: { type: "string", minLength: 1, maxLength: 40 },
    mobilizedAt: { type: ["string", "null"], maxLength: 40 },
    returnedAt: { type: ["string", "null"], maxLength: 40 },
    estimatedCost: { type: "number", minimum: 0 },
    actualCost: { type: "number", minimum: 0 },
    currency: { type: "string", enum: ["NGN", "USD"] },
    deliveryLocation: { type: ["string", "null"], maxLength: 200 },
    operatorRequired: { type: "boolean" },
    notes: { type: ["string", "null"], maxLength: 2000 },
  },
} as const;

const equipmentPatchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: equipmentBody.properties,
} as const;

const materialsEquipmentRoutes: FastifyPluginAsync = async (fastify) => {
  const service = materialsEquipmentService(materialsEquipmentRepository(fastify.db));

  fastify.get<{ Params: { id: string }; Querystring: { status?: MaterialOrderStatus } }>(
    "/projects/:id/materials/orders",
    { schema: { params: projectIdParams, querystring: materialQuery } },
    async (request) => {
      await request.requireProjectAccess(request.params.id);
      return service.listMaterialOrders(request.params.id, request.query.status);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateMaterialOrderInput }>(
    "/projects/:id/materials/orders",
    { schema: { params: projectIdParams, body: materialBody } },
    async (request) => {
      await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      return service.createMaterialOrder(request.params.id, request.body, user.id);
    },
  );

  fastify.patch<{ Params: { id: string; orderId: string }; Body: UpdateMaterialOrderInput }>(
    "/projects/:id/materials/orders/:orderId",
    { schema: { params: materialParams, body: materialPatchBody } },
    async (request) => {
      await request.requireProjectWrite(request.params.id);
      return service.updateMaterialOrder(request.params.id, request.params.orderId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; orderId: string } }>(
    "/projects/:id/materials/orders/:orderId",
    { schema: { params: materialParams } },
    async (request, reply) => {
      await request.requireProjectWrite(request.params.id);
      await service.deleteMaterialOrder(request.params.id, request.params.orderId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: { bucket?: EquipmentBucket } }>(
    "/projects/:id/equipment-requests",
    { schema: { params: projectIdParams, querystring: equipmentQuery } },
    async (request) => {
      await request.requireProjectAccess(request.params.id);
      return service.listEquipmentRequests(request.params.id, request.query.bucket);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateEquipmentRequestInput }>(
    "/projects/:id/equipment-requests",
    { schema: { params: projectIdParams, body: equipmentBody } },
    async (request) => {
      await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      return service.createEquipmentRequest(request.params.id, request.body, user.id);
    },
  );

  fastify.patch<{ Params: { id: string; requestId: string }; Body: UpdateEquipmentRequestInput }>(
    "/projects/:id/equipment-requests/:requestId",
    { schema: { params: equipmentParams, body: equipmentPatchBody } },
    async (request) => {
      await request.requireProjectWrite(request.params.id);
      return service.updateEquipmentRequest(request.params.id, request.params.requestId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; requestId: string } }>(
    "/projects/:id/equipment-requests/:requestId",
    { schema: { params: equipmentParams } },
    async (request, reply) => {
      await request.requireProjectWrite(request.params.id);
      await service.deleteEquipmentRequest(request.params.id, request.params.requestId);
      return reply.status(204).send();
    },
  );
};

export default materialsEquipmentRoutes;
