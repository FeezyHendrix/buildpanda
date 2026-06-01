import type { Knex } from "knex";

const MATERIAL_STATUS = ["Draft", "Requested", "Approved", "Ordered", "PartiallyDelivered", "Delivered", "Cancelled"] as const;
const MATERIAL_PRIORITY = ["Low", "Normal", "High", "Critical"] as const;
const EQUIPMENT_STATUS = ["Draft", "Requested", "Approved", "Scheduled", "OnHire", "Returned", "Cancelled"] as const;
const EQUIPMENT_PRIORITY = ["Low", "Normal", "High", "Critical"] as const;

function check(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("material_orders", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("material_name").notNullable();
    table.decimal("quantity", 14, 2).notNullable().defaultTo(0);
    table.text("unit").notNullable().defaultTo("item");
    table.text("supplier");
    table.text("status").notNullable().defaultTo("Requested");
    table.text("priority").notNullable().defaultTo("Normal");
    table.text("phase_id").references("id").inTable("project_phases").onDelete("SET NULL");
    table.text("activity_id").references("id").inTable("activities").onDelete("SET NULL");
    table.text("document_id").references("id").inTable("project_documents").onDelete("SET NULL");
    table.text("requested_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("needed_by").notNullable();
    table.text("ordered_at");
    table.text("expected_delivery_at");
    table.text("delivered_at");
    table.decimal("estimated_cost", 14, 2).notNullable().defaultTo(0);
    table.decimal("actual_cost", 14, 2).notNullable().defaultTo(0);
    table.text("currency").notNullable().defaultTo("NGN");
    table.text("delivery_location");
    table.text("notes");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "status"]);
    table.index(["project_id", "needed_by"]);
    table.index(["phase_id"]);
    table.index(["activity_id"]);
  });
  await knex.raw(`ALTER TABLE material_orders ADD CONSTRAINT material_orders_status_check CHECK (status IN (${check(MATERIAL_STATUS)}))`);
  await knex.raw(`ALTER TABLE material_orders ADD CONSTRAINT material_orders_priority_check CHECK (priority IN (${check(MATERIAL_PRIORITY)}))`);
  await knex.raw(`ALTER TABLE material_orders ADD CONSTRAINT material_orders_currency_check CHECK (currency IN ('NGN', 'USD'))`);

  await knex.schema.alterTable("material_procurements", (table) => {
    table.text("material_order_id").references("id").inTable("material_orders").onDelete("SET NULL");
    table.index(["material_order_id"]);
  });

  await knex.schema.createTable("equipment_requests", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("equipment_name").notNullable();
    table.text("equipment_type").notNullable();
    table.integer("quantity").notNullable().defaultTo(1);
    table.text("supplier");
    table.text("status").notNullable().defaultTo("Requested");
    table.text("priority").notNullable().defaultTo("Normal");
    table.text("phase_id").references("id").inTable("project_phases").onDelete("SET NULL");
    table.text("activity_id").references("id").inTable("activities").onDelete("SET NULL");
    table.text("document_id").references("id").inTable("project_documents").onDelete("SET NULL");
    table.text("requested_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("needed_from").notNullable();
    table.text("needed_until").notNullable();
    table.text("mobilized_at");
    table.text("returned_at");
    table.decimal("estimated_cost", 14, 2).notNullable().defaultTo(0);
    table.decimal("actual_cost", 14, 2).notNullable().defaultTo(0);
    table.text("currency").notNullable().defaultTo("NGN");
    table.text("delivery_location");
    table.text("operator_required").notNullable().defaultTo("No");
    table.text("notes");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "status"]);
    table.index(["project_id", "needed_from"]);
    table.index(["phase_id"]);
    table.index(["activity_id"]);
  });
  await knex.raw(`ALTER TABLE equipment_requests ADD CONSTRAINT equipment_requests_status_check CHECK (status IN (${check(EQUIPMENT_STATUS)}))`);
  await knex.raw(`ALTER TABLE equipment_requests ADD CONSTRAINT equipment_requests_priority_check CHECK (priority IN (${check(EQUIPMENT_PRIORITY)}))`);
  await knex.raw(`ALTER TABLE equipment_requests ADD CONSTRAINT equipment_requests_currency_check CHECK (currency IN ('NGN', 'USD'))`);
  await knex.raw("ALTER TABLE equipment_requests ADD CONSTRAINT equipment_requests_quantity_check CHECK (quantity > 0)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("equipment_requests");
  await knex.schema.alterTable("material_procurements", (table) => {
    table.dropColumn("material_order_id");
  });
  await knex.schema.dropTableIfExists("material_orders");
}
