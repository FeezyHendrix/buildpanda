import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.ts";
import { materialsLedgerRepository } from "../materials-ledger/repository.ts";
import { materialsLedgerService } from "../materials-ledger/service.ts";
import { projectsRepository } from "../projects/repository.ts";
import { suppliersRepository } from "../suppliers/repository.ts";
import { suppliersService } from "../suppliers/service.ts";
import { customCategoriesRepository, transactionsRepository } from "../transactions/repository.ts";
import { transactionsService } from "../transactions/service.ts";
import { materialDeliveryService } from "./delivery-service.ts";
import { materialsEquipmentRepository } from "./repository.ts";
import { materialsEquipmentService } from "./service.ts";

/**
 * Composition root for the procurement slice. A delivery has to reach the
 * materials ledger and the cost ledger, and an order has to resolve a supplier
 * on the register — all of that is wired here, through the other modules'
 * services, so the services themselves stay free of cross-module plumbing.
 */
export function buildMaterialsServices(app: FastifyInstance) {
  const repository = materialsEquipmentRepository(app.db);
  const projects = projectsRepository(app.db);
  const suppliers = suppliersService(suppliersRepository(app.db));
  const ledger = materialsLedgerService(materialsLedgerRepository(app.db));
  const transactions = transactionsService(
    transactionsRepository(app.db),
    customCategoriesRepository(app.db),
  );

  async function organizationOf(projectId: string): Promise<string | null> {
    return (await projects.findById(projectId))?.organization_id ?? null;
  }

  const service = materialsEquipmentService(repository, {
    supplierName: async (projectId, supplierId) => {
      const organizationId = await organizationOf(projectId);
      const supplier = await suppliers
        .get({ projectId, organizationId }, supplierId)
        .catch(() => null);
      return supplier?.name ?? null;
    },
  });

  const deliveries = materialDeliveryService(repository, service, {
    // Booking the stock is the same physical event as signing the note, so
    // the receipt is posted accepted rather than waiting for a second pair of
    // eyes that already signed the paperwork.
    bookStock: async ({ projectId, order, quantity, occurredAt, deliveryNote, supplier, actorId }) => {
      const result = await ledger.logEntry(
        projectId,
        {
          entryType: "IN",
          materialName: order.material_name,
          unit: order.unit,
          quantity,
          stageId: order.phase_id,
          occurredAt,
          materialOrderId: order.id,
          activityId: order.activity_id,
          supplier,
          deliveryNote,
          approvalStatus: "Approved",
          reason: deliveryNote ? `Delivery note ${deliveryNote}` : null,
        },
        actorId,
      );
      return result.entry.id;
    },
    // Delivered goods are actual cost on the stage that ordered them. It is a
    // record of money already spent off-platform, not a payment.
    bookCost: async ({ projectId, order, amount, occurredAt, deliveryNote, supplier, actorId }) => {
      const organizationId = await organizationOf(projectId);
      if (!organizationId) {
        logger.warn({ projectId, orderId: order.id }, "Delivery cost not booked: project has no organization");
        return null;
      }
      const transaction = await transactions.create(projectId, organizationId, actorId, {
        title: `Delivered: ${order.material_name}`,
        description: `Goods received against material order ${order.title}`,
        category: "materials",
        amount,
        transactedAt: occurredAt,
        vendor: supplier,
        reference: deliveryNote,
        stageId: order.phase_id,
      });
      return transaction.id;
    },
  });

  return { repository, service, deliveries, suppliers };
}
