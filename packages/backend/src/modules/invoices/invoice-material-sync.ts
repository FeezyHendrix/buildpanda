import type { Knex } from "knex";
import type { MaterialsEquipmentService } from "../materials-equipment/service.ts";
import type { MaterialsLedgerService } from "../materials-ledger/service.ts";
import type { Invoice } from "./types.ts";

export interface InvoiceMaterialSyncResult {
  ordersCreated: number;
  entriesLogged: number;
  skipped: number;
  warnings: string[];
}

export interface InvoiceMaterialSyncDeps {
  db: Knex;
  materialsEquipment: MaterialsEquipmentService;
  materialsLedger: MaterialsLedgerService;
}

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
        const order = await deps.materialsEquipment.createMaterialOrder(
          projectId,
          {
            title: description,
            materialName: description,
            quantity,
            unit,
            supplier,
            status: "Delivered",
            priority: "Normal",
            neededBy,
            deliveredAt,
            estimatedCost: item.amount,
            actualCost: item.amount,
            currency,
            notes: `Auto-created from invoice ${invoice.number ?? invoice.id}`,
            invoiceId: invoice.id,
            invoiceLineItemId: item.id,
          },
          actorId,
        );
        result.ordersCreated += 1;

        try {
          await deps.materialsLedger.logEntry(
            projectId,
            {
              entryType: "IN",
              materialName: description,
              unit,
              quantity,
              occurredAt: deliveredAt,
              materialOrderId: order.id,
              reason: `Delivery per invoice ${invoice.number ?? invoice.id}`,
              idempotencyKey: `mat-inv-${invoice.id}-${item.id}`,
            },
            actorId,
          );
          result.entriesLogged += 1;
        } catch (err) {
          result.warnings.push(
            `Ledger entry failed for "${description}": ${
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
