import { BadRequestError, ConflictError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { MaterialsEquipmentRepository } from "./repository.ts";
import { acceptedQuantity, num, optionalText } from "./mappers.ts";
import type {
  MaterialDelivery,
  MaterialOrder,
  MaterialOrderRow,
  MaterialOrderStatus,
  RecordDeliveryInput,
  UpdateMaterialOrderInput,
} from "./types.ts";

/** What a goods-received event books elsewhere, wired by the route plugin. */
export interface DeliveryDeps {
  /** Books the received quantity into the materials ledger; returns entry id. */
  bookStock?: (input: {
    projectId: string;
    order: MaterialOrderRow;
    quantity: number;
    occurredAt: string;
    deliveryNote: string | null;
    supplier: string | null;
    actorId: string | null;
  }) => Promise<string | null>;
  /** Books the delivered value as an expense on the order's phase. */
  bookCost?: (input: {
    projectId: string;
    order: MaterialOrderRow;
    amount: number;
    occurredAt: string;
    deliveryNote: string | null;
    supplier: string | null;
    actorId: string;
  }) => Promise<string | null>;
}

export interface DeliveryServiceHost {
  materialRow(projectId: string, orderId: string): Promise<MaterialOrderRow>;
  hydrateMaterialOrder(row: MaterialOrderRow): Promise<MaterialOrder>;
  updateMaterialOrder(projectId: string, orderId: string, input: UpdateMaterialOrderInput): Promise<MaterialOrder>;
}

/** How a delivery reached the order, when it was not typed in as one. */
export interface DeliveryOrigin {
  /** A crew receipt already on the ledger, approved by a manager: link it, don't post again. */
  ledgerEntryId?: string;
  /** An invoice already records the cost; booking it again would double it. */
  bookCost?: boolean;
}

const RECEIVABLE_STATUSES: MaterialOrderStatus[] = [
  "Approved",
  "Ordered",
  "PartiallyDelivered",
  "Delivered",
];

export function materialDeliveryService(
  repository: MaterialsEquipmentRepository,
  host: DeliveryServiceHost,
  deps: DeliveryDeps = {},
) {
  return {
    async list(projectId: string, orderId: string): Promise<MaterialDelivery[]> {
      const order = await host.materialRow(projectId, orderId);
      return (await host.hydrateMaterialOrder(order)).deliveries;
    },

    /**
     * One goods-received event: it records what was signed for, closes (or
     * part-closes) the order, books the stock and — when the order is priced —
     * books the cost on the phase. A rejected load is recorded against the
     * supplier and books nothing.
     */
    async record(
      projectId: string,
      orderId: string,
      input: RecordDeliveryInput,
      actorId: string,
      origin: DeliveryOrigin = {},
    ): Promise<MaterialOrder> {
      const order = await host.materialRow(projectId, orderId);
      if (!RECEIVABLE_STATUSES.includes(order.status)) {
        throw new ConflictError(
          `A ${order.status.toLowerCase()} order cannot receive a delivery`,
        );
      }
      if (input.deliveredQty <= 0) {
        throw new BadRequestError("Delivered quantity must be greater than zero");
      }
      const rejected = input.rejected ?? false;
      const rejectedReason = optionalText(input.rejectedReason) ?? null;
      if (rejected && !rejectedReason) {
        throw new BadRequestError("A rejected load must record why it was refused");
      }

      const deliveryNote = optionalText(input.deliveryNote) ?? null;
      const supplier = order.supplier;
      const delivery = await repository.insertDelivery({
        id: generateId("mdel"),
        project_id: projectId,
        order_id: orderId,
        delivered_qty: String(input.deliveredQty),
        delivered_at: input.deliveredAt,
        delivery_note: deliveryNote,
        received_by_id: input.receivedById ?? actorId,
        notes: optionalText(input.notes) ?? null,
        rejected,
        rejected_reason: rejectedReason,
        created_by_id: actorId,
      });

      const deliveries = await repository.listDeliveriesForOrders([orderId]);
      const accepted = acceptedQuantity(deliveries);
      const ordered = num(order.quantity);
      const status: MaterialOrderStatus =
        accepted <= 0 ? order.status : accepted >= ordered ? "Delivered" : "PartiallyDelivered";

      const rate = order.unit_rate === null ? null : Number(order.unit_rate);
      const actualCost = rate === null ? null : Math.round(rate * accepted * 100) / 100;

      const updated = await repository.updateMaterialOrder(orderId, {
        status,
        ...(status === "Delivered" ? { delivered_at: input.deliveredAt } : {}),
        ...(actualCost === null ? {} : { actual_cost: String(actualCost) }),
      });

      if (!rejected) {
        const ledgerEntryId = origin.ledgerEntryId ?? await deps.bookStock?.({
          projectId,
          order,
          quantity: input.deliveredQty,
          occurredAt: input.deliveredAt,
          deliveryNote,
          supplier,
          actorId,
        });
        const amount = rate === null ? 0 : Math.round(rate * input.deliveredQty * 100) / 100;
        const transactionId =
          amount > 0 && origin.bookCost !== false
            ? await deps.bookCost?.({
                projectId,
                order,
                amount,
                occurredAt: input.deliveredAt,
                deliveryNote,
                supplier,
                actorId,
              })
            : null;
        if (ledgerEntryId || transactionId) {
          await repository.linkDeliveryRecords(delivery.id, {
            ledger_entry_id: ledgerEntryId ?? null,
            transaction_id: transactionId ?? null,
          });
        }
      }
      return host.hydrateMaterialOrder(updated ?? order);
    },

    /**
     * An order edit. Marking it Delivered is taken to mean "the rest arrived":
     * it is recorded as a delivery of what was outstanding, so the stock and
     * the cost follow, rather than closing the order with nothing received.
     */
    async update(
      projectId: string,
      orderId: string,
      input: UpdateMaterialOrderInput,
      actorId: string,
    ): Promise<MaterialOrder> {
      if (input.status !== "Delivered") return host.updateMaterialOrder(projectId, orderId, input);
      const { status: _status, deliveredAt, ...rest } = input;
      const order = await host.hydrateMaterialOrder(await host.materialRow(projectId, orderId));
      let result = order;
      if (order.status !== "Delivered") {
        result = await this.record(
          projectId,
          orderId,
          {
            deliveredQty: order.outstandingQuantity > 0 ? order.outstandingQuantity : order.quantity,
            deliveredAt: deliveredAt ?? new Date().toISOString().slice(0, 10),
            notes: "Recorded when the order was marked delivered",
          },
          actorId,
        );
      }
      const others = Object.entries(rest).filter(([, value]) => value !== undefined);
      return others.length ? host.updateMaterialOrder(projectId, orderId, rest) : result;
    },
  };
}

export type MaterialDeliveryService = ReturnType<typeof materialDeliveryService>;
