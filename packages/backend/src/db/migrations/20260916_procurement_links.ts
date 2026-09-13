import type { Knex } from "knex";

const MATERIAL_STATUS = [
  "Draft",
  "Requested",
  "Approved",
  "Ordered",
  "PartiallyDelivered",
  "Delivered",
  "Cancelled",
  "Rejected",
] as const;

const EQUIPMENT_STATUS = [
  "Draft",
  "Requested",
  "Approved",
  "Scheduled",
  "OnHire",
  "Returned",
  "Cancelled",
  "Rejected",
] as const;

function check(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}

/**
 * Procurement links: an order or a hire is a request against the work it
 * unlocks (phase + activity) placed with a supplier on the register, priced at
 * a rate. The free-text `supplier` column stays as the legacy fallback for rows
 * typed before the register existed; `supplier_id` is the relation.
 *
 * The ladder gains Rejected (a load refused on site / a request turned down) to
 * sit beside Cancelled: both are terminal and both carry a reason, so a refused
 * delivery or a killed order stays on file instead of being deleted.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("material_orders", (table) => {
    table.text("supplier_id").references("id").inTable("suppliers").onDelete("SET NULL");
    table.decimal("unit_rate", 14, 2);
    table.text("cancel_reason");
    table.text("rejected_reason");
    table.index(["supplier_id"]);
  });

  await knex.schema.alterTable("equipment_requests", (table) => {
    table.text("supplier_id").references("id").inTable("suppliers").onDelete("SET NULL");
    table.decimal("unit_rate", 14, 2);
    table.text("cancel_reason");
    table.text("rejected_reason");
    // Hire period as actually let, distinct from the requested needed_from /
    // needed_until window: a plant reconciliation is priced off these.
    table.text("on_hire_at");
    table.text("off_hire_at");
    table.text("plant_ref");
    table.decimal("daily_rate", 14, 2);
    // Append-only history of off-hire moves: { at, from, to, reason, actorId }
    table.jsonb("extensions").notNullable().defaultTo(JSON.stringify([]));
    table.index(["supplier_id"]);
  });

  await knex.raw("ALTER TABLE material_orders DROP CONSTRAINT IF EXISTS material_orders_status_check");
  await knex.raw(
    `ALTER TABLE material_orders ADD CONSTRAINT material_orders_status_check CHECK (status IN (${check(MATERIAL_STATUS)}))`,
  );
  await knex.raw("ALTER TABLE equipment_requests DROP CONSTRAINT IF EXISTS equipment_requests_status_check");
  await knex.raw(
    `ALTER TABLE equipment_requests ADD CONSTRAINT equipment_requests_status_check CHECK (status IN (${check(EQUIPMENT_STATUS)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex("material_orders").where({ status: "Rejected" }).update({ status: "Cancelled" });
  await knex("equipment_requests").where({ status: "Rejected" }).update({ status: "Cancelled" });

  await knex.raw("ALTER TABLE material_orders DROP CONSTRAINT IF EXISTS material_orders_status_check");
  await knex.raw(
    `ALTER TABLE material_orders ADD CONSTRAINT material_orders_status_check CHECK (status IN (${check(
      MATERIAL_STATUS.filter((s) => s !== "Rejected"),
    )}))`,
  );
  await knex.raw("ALTER TABLE equipment_requests DROP CONSTRAINT IF EXISTS equipment_requests_status_check");
  await knex.raw(
    `ALTER TABLE equipment_requests ADD CONSTRAINT equipment_requests_status_check CHECK (status IN (${check(
      EQUIPMENT_STATUS.filter((s) => s !== "Rejected"),
    )}))`,
  );

  await knex.schema.alterTable("equipment_requests", (table) => {
    table.dropIndex(["supplier_id"]);
    table.dropColumn("extensions");
    table.dropColumn("daily_rate");
    table.dropColumn("plant_ref");
    table.dropColumn("off_hire_at");
    table.dropColumn("on_hire_at");
    table.dropColumn("rejected_reason");
    table.dropColumn("cancel_reason");
    table.dropColumn("unit_rate");
    table.dropColumn("supplier_id");
  });

  await knex.schema.alterTable("material_orders", (table) => {
    table.dropIndex(["supplier_id"]);
    table.dropColumn("rejected_reason");
    table.dropColumn("cancel_reason");
    table.dropColumn("unit_rate");
    table.dropColumn("supplier_id");
  });
}
