import type { Knex } from "knex";
import { stagesRepository } from "../stages/repository.ts";
import { buildMaterialsServices } from "../materials-equipment/wiring.ts";
import { logger } from "../../lib/logger.ts";
import { purchaseOrdersRepository } from "./repository.ts";
import { purchaseOrdersService } from "./service.ts";

export function buildPurchaseOrdersService(db: Knex) {
  const stages = stagesRepository(db);
  const procurement = buildMaterialsServices({ db });
  const materials = procurement.service;
  return purchaseOrdersService(purchaseOrdersRepository(db), {
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
}
