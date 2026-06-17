import type { Knex } from "knex";

const ENTRY_TYPE = ["IN", "USED", "VOID"] as const;
const ENTRY_STATUS = ["Posted", "Voided"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("materials_catalog", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("normalized_name").notNullable();
    table.text("unit").notNullable().defaultTo("item");
    table.decimal("low_stock_threshold", 14, 2);
    table.boolean("active").notNullable().defaultTo(true);
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "active"]);
  });
  await knex.raw(
    "CREATE UNIQUE INDEX materials_catalog_unique ON materials_catalog (project_id, normalized_name, unit)",
  );

  await knex.schema.createTable("material_ledger_entries", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("idempotency_key").notNullable();
    table.text("entry_type").notNullable();
    table.text("status").notNullable().defaultTo("Posted");
    table.text("material_id").notNullable().references("id").inTable("materials_catalog").onDelete("RESTRICT");
    table.text("material_name_snapshot").notNullable();
    table.text("unit_snapshot").notNullable();
    table.text("location_key").notNullable().defaultTo("default");
    table.decimal("quantity", 14, 2).notNullable();
    table.decimal("stock_delta", 14, 2).notNullable();
    table.timestamp("occurred_at", { useTz: true }).notNullable();
    table.boolean("timestamp_suspect").notNullable().defaultTo(false);
    table.boolean("negative_stock").notNullable().defaultTo(false);
    table.text("logged_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("material_order_id").references("id").inTable("material_orders").onDelete("SET NULL");
    table.text("task_id").references("id").inTable("tasks").onDelete("SET NULL");
    table.text("activity_id").references("id").inTable("activities").onDelete("SET NULL");
    table.text("reversal_for_entry_id").references("id").inTable("material_ledger_entries").onDelete("RESTRICT");
    table.text("reason");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "material_id"]);
    table.index(["project_id", "occurred_at"]);
    table.index(["project_id", "material_order_id"]);
    table.index(["project_id", "task_id"]);
    table.index(["logged_by_id", "created_at"]);
  });
  await knex.raw(`ALTER TABLE material_ledger_entries ADD CONSTRAINT material_ledger_entries_type_check CHECK (entry_type IN (${check(ENTRY_TYPE)}))`);
  await knex.raw(`ALTER TABLE material_ledger_entries ADD CONSTRAINT material_ledger_entries_status_check CHECK (status IN (${check(ENTRY_STATUS)}))`);
  await knex.raw("ALTER TABLE material_ledger_entries ADD CONSTRAINT material_ledger_entries_qty_positive CHECK (quantity > 0)");
  await knex.raw("ALTER TABLE material_ledger_entries ADD CONSTRAINT material_ledger_entries_void_ref CHECK (entry_type <> 'VOID' OR reversal_for_entry_id IS NOT NULL)");
  await knex.raw("CREATE UNIQUE INDEX material_ledger_entries_idempotency ON material_ledger_entries (project_id, idempotency_key)");
  await knex.raw("CREATE UNIQUE INDEX material_ledger_entries_reversal_once ON material_ledger_entries (reversal_for_entry_id) WHERE reversal_for_entry_id IS NOT NULL");

  await knex.schema.createTable("material_ledger_entry_files", (table) => {
    table.text("entry_id").notNullable().references("id").inTable("material_ledger_entries").onDelete("CASCADE");
    table.text("file_id").notNullable().references("id").inTable("uploaded_files").onDelete("RESTRICT");
    table.text("purpose").notNullable().defaultTo("ProofPhoto");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(["entry_id", "file_id"]);
  });

  await knex.schema.createTable("material_ledger_entry_events", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("entry_id").notNullable().references("id").inTable("material_ledger_entries").onDelete("CASCADE");
    table.text("event_type").notNullable();
    table.text("actor_id").references("id").inTable("user").onDelete("SET NULL");
    table.jsonb("detail");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["entry_id", "created_at"]);
  });

  await knex.schema.createTable("materials_stock", (table) => {
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("material_id").notNullable().references("id").inTable("materials_catalog").onDelete("RESTRICT");
    table.text("location_key").notNullable().defaultTo("default");
    table.decimal("on_hand_qty", 14, 2).notNullable().defaultTo(0);
    table.text("last_ledger_entry_id").references("id").inTable("material_ledger_entries").onDelete("SET NULL");
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(["project_id", "material_id", "location_key"]);
    table.index(["project_id", "material_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("materials_stock");
  await knex.schema.dropTableIfExists("material_ledger_entry_events");
  await knex.schema.dropTableIfExists("material_ledger_entry_files");
  await knex.schema.dropTableIfExists("material_ledger_entries");
  await knex.schema.dropTableIfExists("materials_catalog");
}
