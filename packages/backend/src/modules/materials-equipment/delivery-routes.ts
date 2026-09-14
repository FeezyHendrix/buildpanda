import type { FastifyPluginAsync } from "fastify";
import { assertMaterialsAction } from "./permissions.ts";
import {
  deliveryBody,
  deliveryResponse,
  materialOrderResponse,
  materialParams,
} from "./schemas.ts";
import { buildMaterialsServices } from "./wiring.ts";
import type { RecordDeliveryInput } from "./types.ts";

const deliveryRoutes: FastifyPluginAsync = async (fastify) => {
  const { deliveries } = buildMaterialsServices(fastify);

  fastify.get<{ Params: { id: string; orderId: string } }>(
    "/projects/:id/materials/orders/:orderId/deliveries",
    {
      schema: {
        params: materialParams,
        response: { 200: { type: "array", items: deliveryResponse } },
      },
    },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "view");
      return deliveries.list(request.params.id, request.params.orderId);
    },
  );

  // Signing for goods is the approval-tier act: it closes the order, books the
  // stock and books the cost, so it needs the same permission as approving.
  fastify.post<{ Params: { id: string; orderId: string }; Body: RecordDeliveryInput }>(
    "/projects/:id/materials/orders/:orderId/deliveries",
    { schema: { params: materialParams, body: deliveryBody, response: { 201: materialOrderResponse } } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      assertMaterialsAction(request, project, "approve");
      const user = request.requireAuth();
      const order = await deliveries.record(
        request.params.id,
        request.params.orderId,
        request.body,
        user.id,
      );
      return reply.status(201).send(order);
    },
  );
};

export default deliveryRoutes;
