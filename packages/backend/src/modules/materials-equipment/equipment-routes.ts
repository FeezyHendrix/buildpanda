import type { FastifyPluginAsync } from "fastify";
import { EQUIPMENT_APPROVAL_STATUSES, assertMaterialsAction } from "./permissions.ts";
import {
  equipmentBody,
  equipmentParams,
  equipmentPatchBody,
  equipmentQuery,
  equipmentResponse,
  extendHireBody,
  projectIdParams,
} from "./schemas.ts";
import { buildMaterialsServices } from "./wiring.ts";
import type {
  CreateEquipmentRequestInput,
  EquipmentBucket,
  ExtendHireInput,
  UpdateEquipmentRequestInput,
} from "./types.ts";

const equipmentRoutes: FastifyPluginAsync = async (fastify) => {
  const { service } = buildMaterialsServices(fastify);

  fastify.get<{ Params: { id: string }; Querystring: { bucket?: EquipmentBucket } }>(
    "/projects/:id/equipment-requests",
    {
      schema: {
        params: projectIdParams,
        querystring: equipmentQuery,
        response: { 200: { type: "array", items: equipmentResponse } },
      },
    },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "view");
      return service.listEquipmentRequests(request.params.id, request.query.bucket);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateEquipmentRequestInput }>(
    "/projects/:id/equipment-requests",
    { schema: { params: projectIdParams, body: equipmentBody, response: { 200: equipmentResponse } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      assertMaterialsAction(request, project, "request");
      const user = request.requireAuth();
      return service.createEquipmentRequest(request.params.id, request.body, user.id);
    },
  );

  fastify.patch<{ Params: { id: string; requestId: string }; Body: UpdateEquipmentRequestInput }>(
    "/projects/:id/equipment-requests/:requestId",
    { schema: { params: equipmentParams, body: equipmentPatchBody, response: { 200: equipmentResponse } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      const needsApprove =
        request.body.status !== undefined && EQUIPMENT_APPROVAL_STATUSES.has(request.body.status);
      assertMaterialsAction(request, project, needsApprove ? "approve" : "request");
      return service.updateEquipmentRequest(request.params.id, request.params.requestId, request.body);
    },
  );

  // Extending a hire is a variation on the hire order, so it has its own action
  // and its own history — not an edit of "needed until".
  fastify.post<{ Params: { id: string; requestId: string }; Body: ExtendHireInput }>(
    "/projects/:id/equipment-requests/:requestId/extend",
    { schema: { params: equipmentParams, body: extendHireBody, response: { 200: equipmentResponse } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      assertMaterialsAction(request, project, "approve");
      const user = request.requireAuth();
      return service.extendHire(request.params.id, request.params.requestId, request.body, user.id);
    },
  );

  fastify.delete<{ Params: { id: string; requestId: string } }>(
    "/projects/:id/equipment-requests/:requestId",
    { schema: { params: equipmentParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      assertMaterialsAction(request, project, "approve");
      await service.deleteEquipmentRequest(request.params.id, request.params.requestId);
      return reply.status(204).send();
    },
  );
};

export default equipmentRoutes;
