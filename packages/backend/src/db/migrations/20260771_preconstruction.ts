import type { Knex } from "knex";

const SESSION_STATUSES = ["uploading", "generating", "reviewing", "output", "failed"] as const;
const SHEET_KINDS = ["floor-plan", "elevation", "section", "detail", "schedule", "unknown"] as const;
const SHEET_STATUSES = ["pending", "measured", "unmeasurable"] as const;
const DIM_UNITS = ["mm", "cm", "m"] as const;
const ROW_TYPES = ["heading", "work_section", "spec_note", "item", "provisional_sum"] as const;
const ROW_STATUSES = ["ai_generated", "needs_review", "verified", "rejected"] as const;
const CONFIDENCES = ["high", "low"] as const;
const GEOMETRY_KINDS = ["area", "linear", "count", "deduction"] as const;
const GEOMETRY_SOURCES = ["ai", "manual"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("precon_sessions", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("status").notNullable().defaultTo("uploading");
    table.text("title").notNullable();
    table.text("error");
    table.text("created_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE precon_sessions ADD CONSTRAINT precon_sessions_status_check CHECK (status IN (${check(SESSION_STATUSES)}))`,
  );

  await knex.schema.createTable("precon_sheets", (table) => {
    table.text("id").primary();
    table.text("session_id").notNullable().references("id").inTable("precon_sessions").onDelete("CASCADE");
    table.text("file_name").notNullable();
    table.text("storage_path").notNullable();
    table.integer("page_number").notNullable();
    table.text("code");
    table.text("title");
    table.text("kind").notNullable().defaultTo("unknown");
    table.text("status").notNullable().defaultTo("pending");
    table.float("scale_mm_per_pt");
    table.float("scale_confidence");
    table.text("dim_unit");
    table.jsonb("snap_index");
    table.text("error");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["session_id", "page_number"]);
  });
  await knex.raw(
    `ALTER TABLE precon_sheets ADD CONSTRAINT precon_sheets_kind_check CHECK (kind IN (${check(SHEET_KINDS)}))`,
  );
  await knex.raw(
    `ALTER TABLE precon_sheets ADD CONSTRAINT precon_sheets_status_check CHECK (status IN (${check(SHEET_STATUSES)}))`,
  );
  await knex.raw(
    `ALTER TABLE precon_sheets ADD CONSTRAINT precon_sheets_dim_unit_check CHECK (dim_unit IS NULL OR dim_unit IN (${check(DIM_UNITS)}))`,
  );

  await knex.schema.createTable("precon_bills", (table) => {
    table.text("id").primary();
    table.text("session_id").notNullable().references("id").inTable("precon_sessions").onDelete("CASCADE");
    table.text("title").notNullable();
    table.integer("sort").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["session_id", "sort"]);
  });

  await knex.schema.createTable("precon_boq_rows", (table) => {
    table.text("id").primary();
    table.text("bill_id").notNullable().references("id").inTable("precon_bills").onDelete("CASCADE");
    table.integer("sort").notNullable().defaultTo(0);
    table.text("row_type").notNullable();
    table.text("element_group");
    table.text("code");
    table.text("description").notNullable().defaultTo("");
    table.text("unit");
    table.decimal("qty_gross", 14, 2);
    table.jsonb("deductions").notNullable().defaultTo("[]");
    table.decimal("qty", 14, 2);
    table.decimal("rate", 14, 2);
    table.decimal("amount", 14, 2);
    table.text("rate_source");
    table.text("confidence");
    table.text("status");
    table.integer("version").notNullable().defaultTo(1);
    table.text("measurement_basis");
    table.text("verified_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("verified_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["bill_id", "sort"]);
  });
  await knex.raw(
    `ALTER TABLE precon_boq_rows ADD CONSTRAINT precon_boq_rows_row_type_check CHECK (row_type IN (${check(ROW_TYPES)}))`,
  );
  await knex.raw(
    `ALTER TABLE precon_boq_rows ADD CONSTRAINT precon_boq_rows_status_check CHECK (status IS NULL OR status IN (${check(ROW_STATUSES)}))`,
  );
  await knex.raw(
    `ALTER TABLE precon_boq_rows ADD CONSTRAINT precon_boq_rows_confidence_check CHECK (confidence IS NULL OR confidence IN (${check(CONFIDENCES)}))`,
  );

  await knex.schema.createTable("precon_geometries", (table) => {
    table.text("id").primary();
    table.text("row_id").notNullable().references("id").inTable("precon_boq_rows").onDelete("CASCADE");
    table.text("sheet_id").notNullable().references("id").inTable("precon_sheets").onDelete("CASCADE");
    table.text("kind").notNullable();
    table.jsonb("vertices").notNullable().defaultTo("[]");
    table.text("source").notNullable().defaultTo("ai");
    table.decimal("quantity", 14, 2);
    table.text("unit");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["row_id"]);
    table.index(["sheet_id"]);
  });
  await knex.raw(
    `ALTER TABLE precon_geometries ADD CONSTRAINT precon_geometries_kind_check CHECK (kind IN (${check(GEOMETRY_KINDS)}))`,
  );
  await knex.raw(
    `ALTER TABLE precon_geometries ADD CONSTRAINT precon_geometries_source_check CHECK (source IN (${check(GEOMETRY_SOURCES)}))`,
  );

  await knex.schema.createTable("precon_audit_events", (table) => {
    table.text("id").primary();
    table.text("session_id").notNullable().references("id").inTable("precon_sessions").onDelete("CASCADE");
    table.text("row_id");
    table.text("actor").notNullable();
    table.text("action").notNullable();
    table.jsonb("before");
    table.jsonb("after");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["session_id", "created_at"]);
    table.index(["row_id"]);
  });

  await knex.schema.createTable("precon_summary_settings", (table) => {
    table.text("session_id").primary().references("id").inTable("precon_sessions").onDelete("CASCADE");
    table.decimal("prelims_pct", 5, 2).notNullable().defaultTo(5);
    table.decimal("contingency_pct", 5, 2).notNullable().defaultTo(5);
    table.decimal("vat_pct", 5, 2).notNullable().defaultTo(7.5);
  });

  await knex.schema.createTable("precon_rate_cards", (table) => {
    table.text("id").primary();
    table.text("org_id").notNullable().references("id").inTable("organization").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("region");
    table.text("currency").notNullable().defaultTo("NGN");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["org_id"]);
  });

  await knex.schema.createTable("precon_rates", (table) => {
    table.text("id").primary();
    table.text("rate_card_id").notNullable().references("id").inTable("precon_rate_cards").onDelete("CASCADE");
    table.text("code_prefix");
    table.text("description_pattern");
    table.text("unit").notNullable();
    table.decimal("rate", 14, 2).notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["rate_card_id"]);
  });

  await knex.schema.createTable("precon_compliance_docs", (table) => {
    table.text("id").primary();
    table.text("org_id").notNullable().references("id").inTable("organization").onDelete("CASCADE");
    table.text("file_name").notNullable();
    table.text("storage_path").notNullable();
    table.text("doc_type").notNullable();
    table.date("expiry_date");
    table.text("uploaded_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["org_id", "doc_type"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("precon_compliance_docs");
  await knex.schema.dropTableIfExists("precon_rates");
  await knex.schema.dropTableIfExists("precon_rate_cards");
  await knex.schema.dropTableIfExists("precon_summary_settings");
  await knex.schema.dropTableIfExists("precon_audit_events");
  await knex.schema.dropTableIfExists("precon_geometries");
  await knex.schema.dropTableIfExists("precon_boq_rows");
  await knex.schema.dropTableIfExists("precon_bills");
  await knex.schema.dropTableIfExists("precon_sheets");
  await knex.schema.dropTableIfExists("precon_sessions");
}
