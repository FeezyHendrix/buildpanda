import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { logger } from "../../lib/logger.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { tasksRepository } from "../tasks/repository.ts";
import { tasksService } from "../tasks/service.ts";
import { projectsRepository } from "../projects/repository.ts";
import { materialsEquipmentRepository } from "../materials-equipment/repository.ts";
import { materialsEquipmentService } from "../materials-equipment/service.ts";
import { buildMaterialsServices } from "../materials-equipment/wiring.ts";
import { suppliersRepository } from "../suppliers/repository.ts";
import { materialsLedgerRepository } from "./repository.ts";
import { materialsLedgerService } from "./service.ts";
import { sameMaterial } from "./units.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { materialLedgerNotificationQueue } from "./notification-queue.ts";

const RECEIVABLE: readonly string[] = ["Approved", "Ordered", "PartiallyDelivered", "Delivered"];

/** Shared composition keeps HTTP and confirmed field actions on the same stock workflow. */
export function buildMaterialsLedgerService(db: Knex, queue?: Pick<QueueManager, "enqueue">) {
  const notifications = notificationsService(notificationsRepository(db), materialLedgerNotificationQueue(db, queue));
  const tasks = tasksService(tasksRepository(db), { notifications }, buildingsRepository(db).soleRealBuildingId);
  const projects = projectsRepository(db);
  const orders = materialsEquipmentService(materialsEquipmentRepository(db));
  const procurement = buildMaterialsServices({ db });
  const suppliers = suppliersRepository(db);

  return materialsLedgerService(materialsLedgerRepository(db), {
    onNegativeStock: async ({ projectId, materialName, onHandQty, actorId }) => {
      try {
        const project = await projects.findById(projectId);
        const ownerId = project?.owner_id ?? null;
        if (ownerId) {
          await notifications.notify(ownerId, "material_negative_stock", {
            title: "Negative stock detected",
            body: `${materialName} is at ${onHandQty}. Logged usage exceeds recorded deliveries.`,
            projectId,
          });
        }
        await tasks.createTask(
          projectId,
          {
            title: `Reconcile negative stock: ${materialName}`,
            description: `On-hand for ${materialName} is ${onHandQty}. Confirm deliveries were logged or correct the ledger.`,
            assigneeId: ownerId,
            sourceType: "material_reconciliation",
            sourceId: materialName,
          },
          actorId,
        );
      } catch (error) {
        logger.error({ err: error, projectId }, "Failed negative-stock side effects");
      }
    },
    // Reorder policy: low stock always raises a heads-up notification. When the
    // material has auto-reorder enabled, we go further and raise a "Requested"
    // material order against the preferred supplier so procurement can act on
    // it immediately rather than discovering the shortfall later.
    receiptOrder: async (projectId, orderId) => {
      const order = await procurement.service.getMaterialOrder(projectId, orderId).catch(() => null);
      if (!order) return null;
      return {
        materialName: order.materialName,
        unit: order.unit,
        stageId: order.phaseId,
        // Goods count against an order once it is approved; before that there
        // is nothing agreed to receive them against.
        receivable: RECEIVABLE.includes(order.status),
      };
    },
    soleOpenOrderFor: async (projectId, materialName) => {
      const open = (await procurement.service.listMaterialOrders(projectId)).filter(
        (order) => RECEIVABLE.includes(order.status) && order.status !== "Delivered" && sameMaterial(order.materialName, materialName),
      );
      return open.length === 1 ? open[0]!.id : null;
    },
    // Accepting the receipt is the moment the goods count; the order learns of
    // them now, not when the crew claimed them.
    onReceiptApproved: async ({ projectId, entryId, materialOrderId, quantity, occurredAt, deliveryNote, actorId }) => {
      // The stock is already accepted; an order that has since been closed
      // must not undo that, so a failure here is logged, not thrown.
      try {
        await procurement.deliveries.record(
          projectId,
          materialOrderId,
          { deliveredQty: quantity, deliveredAt: occurredAt.slice(0, 10), deliveryNote, notes: "Logged on site and approved" },
          actorId,
          { ledgerEntryId: entryId },
        );
      } catch (error) {
        logger.warn({ err: error, projectId, entryId, materialOrderId }, "Approved receipt not recorded on its order");
      }
    },
    onLowStock: async ({
      projectId,
      materialName,
      unit,
      onHandQty,
      lowStockThreshold,
      reorderQuantity,
      leadTimeDays,
      preferredSupplierId,
      autoReorderEnabled,
      actorId,
    }) => {
      try {
        const project = await projects.findById(projectId);
        const ownerId = project?.owner_id ?? null;
        if (ownerId) {
          await notifications.notify(ownerId, "material_low_stock", {
            title: "Material stock is low",
            body: `${materialName} is at ${onHandQty} ${unit}, at or below the reorder point of ${lowStockThreshold}.`,
            projectId,
          });
        }

        if (!autoReorderEnabled) return;

        // requestedBy: the ledger actor is normally set (the route requires
        // auth), but fall back to the project owner so an order can still
        // be raised if this is ever triggered without one.
        const requestedBy = actorId ?? ownerId;
        if (!requestedBy) return;

        const supplier = preferredSupplierId ? await suppliers.findById(preferredSupplierId) : undefined;
        const quantity = reorderQuantity ?? lowStockThreshold * 2;
        const neededBy = new Date(Date.now() + (leadTimeDays ?? 7) * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        await orders.createMaterialOrder(
          projectId,
          {
            title: `Auto reorder: ${materialName}`,
            materialName,
            quantity,
            unit,
            supplier: supplier?.name ?? null,
            status: "Requested",
            priority: "High",
            neededBy,
            notes: `Auto-generated by reorder policy — stock at ${onHandQty} ${unit}, at or below the reorder point of ${lowStockThreshold}.`,
          },
          requestedBy,
        );

        if (ownerId) {
          await notifications.notify(ownerId, "material_reorder_created", {
            title: "Reorder request created",
            body: `A reorder request for ${quantity} ${unit} of ${materialName} was auto-created${supplier ? ` for ${supplier.name}` : ""}.`,
            projectId,
          });
        }
      } catch (error) {
        logger.error({ err: error, projectId }, "Failed low-stock side effects");
      }
    },
  });
}
