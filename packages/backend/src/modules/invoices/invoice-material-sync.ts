import type { Knex } from "knex";
import type { MaterialDeliveryService } from "../materials-equipment/delivery-service.ts";
import type { MaterialsEquipmentService } from "../materials-equipment/service.ts";
import { sameMaterial } from "../materials-ledger/units.ts";
import type { Invoice } from "./types.ts";

export interface InvoiceMaterialSyncResult {
  ordersCreated: number;
  /** Lines that matched an order already placed for the material. */
  ordersMatched: number;
  entriesLogged: number;
  skipped: number;
  warnings: string[];
}

export interface InvoiceMaterialSyncDeps {
  db: Knex;
  materialsEquipment: MaterialsEquipmentService;
  deliveries: MaterialDeliveryService;
}

/** Orders that can still take goods and have no invoice line yet. */
const OPEN_STATUSES = ["Approved", "Ordered", "PartiallyDelivered"];

export function invoiceMaterialSyncer(deps: InvoiceMaterialSyncDeps) {
  async function alreadySynced(
    invoiceLineItemId: string,
  ): Promise<{ orderId: string } | null> {
    const row = await deps
      .db<{ id: string }>("material_orders")
      .where({ invoice_line_item_id: invoiceLineItemId })
      .select("id")
      .first();
    return row ? { orderId: row.id } : null;
  }

  async function sync(
    projectId: string,
    invoice: Invoice,
    actorId: string,
  ): Promise<InvoiceMaterialSyncResult> {
    const result: InvoiceMaterialSyncResult = {
      ordersCreated: 0,
      ordersMatched: 0,
      entriesLogged: 0,
      skipped: 0,
      warnings: [],
    };

    if (invoice.invoiceType !== "material") return result;
    if (invoice.lineItems.length === 0) return result;

    const supplier = invoice.vendorName?.trim() || null;
    const neededBy = invoice.issueDate ?? new Date().toISOString().slice(0, 10);
    const deliveredAt = invoice.issueDate ?? new Date().toISOString();
    const currency =
      (invoice.currency as
        | "NGN"
        | "USD"
        | "GBP"
        | "EUR"
        | "GHS"
        | "ZAR"
        | "KES") ?? "NGN";

    const openOrders: Array<{ id: string; material_name: string }> = await deps
      .db("material_orders")
      .where({ project_id: projectId })
      .whereIn("status", OPEN_STATUSES)
      .whereNull("invoice_line_item_id")
      .orderBy("created_at", "asc")
      .select("id", "material_name");
    const deliveryNote = invoice.number ? `Invoice ${invoice.number}` : "Invoice";

    for (const item of invoice.lineItems) {
      const description = (item.description || "").trim();
      if (description.length === 0) {
        result.warnings.push(
          `Skipped line item ${item.position + 1}: no description`,
        );
        result.skipped += 1;
        continue;
      }
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        result.warnings.push(
          `Skipped "${description}": non-positive quantity (${item.quantity})`,
        );
        result.skipped += 1;
        continue;
      }
      const unit = (item.unit || "item").trim() || "item";

      const existing = await alreadySynced(item.id);
      if (existing) {
        result.skipped += 1;
        continue;
      }

      try {
        // An invoice for goods already ordered is the delivery of that order,
        // not a second order: it counts against the oldest open one.
        const matchIndex = openOrders.findIndex((o) => sameMaterial(o.material_name, description));
        let orderId: string;
        if (matchIndex >= 0) {
          orderId = openOrders[matchIndex]!.id;
          openOrders.splice(matchIndex, 1);
          await deps.db("material_orders").where({ id: orderId }).update({
            invoice_id: invoice.id,
            invoice_line_item_id: item.id,
            updated_at: new Date(),
          });
          result.ordersMatched += 1;
        } else {
          const order = await deps.materialsEquipment.createMaterialOrder(
            projectId,
            {
              title: description,
              materialName: description,
              quantity,
              unit,
              supplier,
              status: "Ordered",
              priority: "Normal",
              neededBy,
              orderedAt: neededBy,
              estimatedCost: item.amount,
              currency,
              notes: `Auto-created from invoice ${invoice.number ?? invoice.id}`,
              invoiceId: invoice.id,
              invoiceLineItemId: item.id,
            },
            actorId,
          );
          orderId = order.id;
          result.ordersCreated += 1;
        }

        try {
          // The invoice already records the cost, so the delivery books only
          // the stock and the order's progress.
          await deps.deliveries.record(
            projectId,
            orderId,
            { deliveredQty: quantity, deliveredAt: deliveredAt.slice(0, 10), deliveryNote, notes: `Delivered per ${deliveryNote.toLowerCase()}` },
            actorId,
            { bookCost: false },
          );
          result.entriesLogged += 1;
        } catch (err) {
          result.warnings.push(
            `Delivery not recorded for "${description}": ${
              err instanceof Error ? err.message : "unknown error"
            }`,
          );
        }
      } catch (err) {
        result.warnings.push(
          `Order creation failed for "${description}": ${
            err instanceof Error ? err.message : "unknown error"
          }`,
        );
      }
    }

    return result;
  }

  return { sync };
}

export type InvoiceMaterialSyncer = ReturnType<typeof invoiceMaterialSyncer>;
