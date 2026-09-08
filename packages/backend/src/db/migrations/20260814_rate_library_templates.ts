import type { Knex } from "knex";

const BUILDUP_COMPONENTS = ["labour", "material", "plant", "subcontract", "overhead"] as const;
const COMPLIANCE_DOC_TYPES = [
  "insurance_car",
  "insurance_public_liability",
  "performance_bond",
  "advance_payment_guarantee",
  "tax_clearance",
  "cac",
  "other",
] as const;
const JOB_PROFILES = ["full_contract", "labour_only", "supply_only"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

// Rate library: a rate can be built up from components (labour, material with
// waste, plant, subcontract, overhead) and backed by a dated quote. Compliance
// documents get a typed doc_type and expiry tracking. Proposal templates hold
// the reusable parts of an offer (pack text, payment schedule, terms).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_rate_cards", (table) => {
    table.boolean("is_default").notNullable().defaultTo(false);
  });
  await knex.schema.alterTable("precon_rates", (table) => {
    table.text("label");
  });

  await knex.schema.createTable("precon_rate_buildups", (table) => {
    table.text("id").primary();
    table.text("rate_id").notNullable().references("id").inTable("precon_rates").onDelete("CASCADE");
    table.text("component").notNullable();
    table.text("description").notNullable();
    table.decimal("qty", 14, 3).notNullable().defaultTo(1);
    table.text("unit").notNullable().defaultTo("item");
    table.decimal("unit_cost", 14, 2).notNullable().defaultTo(0);
    table.decimal("waste_pct", 6, 2).notNullable().defaultTo(0);
    table.integer("sort").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["rate_id", "sort"]);
  });
  await knex.raw(
    `ALTER TABLE precon_rate_buildups ADD CONSTRAINT precon_rate_buildups_component_check CHECK (component IN (${check(BUILDUP_COMPONENTS)}))`,
  );

  await knex.schema.createTable("precon_quote_sources", (table) => {
    table.text("id").primary();
    table.text("org_id").notNullable().references("id").inTable("organization").onDelete("CASCADE");
    table.text("rate_id").references("id").inTable("precon_rates").onDelete("SET NULL");
    table.text("supplier_name").notNullable();
    table.text("reference");
    table.date("valid_until");
    table.text("file_id").references("id").inTable("uploaded_files").onDelete("SET NULL");
    table.decimal("amount", 14, 2);
    table.text("unit");
    table.text("notes");
    table.text("created_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["org_id", "valid_until"]);
    table.index(["rate_id"]);
  });

  await knex.schema.alterTable("precon_compliance_docs", (table) => {
    table.text("reference");
    table.text("notes");
    table.text("file_id").references("id").inTable("uploaded_files").onDelete("SET NULL");
    table.timestamp("expiring_notified_at", { useTz: true });
    table.timestamp("expired_notified_at", { useTz: true });
  });
  await knex.raw(
    `ALTER TABLE precon_compliance_docs ADD CONSTRAINT precon_compliance_docs_doc_type_check CHECK (doc_type IN (${check(COMPLIANCE_DOC_TYPES)}))`,
  );

  await knex.schema.createTable("proposal_templates", (table) => {
    table.text("id").primary();
    table.text("org_id").notNullable().references("id").inTable("organization").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("job_profile").notNullable().defaultTo("full_contract");
    table.jsonb("pack_sections").notNullable().defaultTo("[]");
    table.jsonb("payment_schedule").notNullable().defaultTo("[]");
    table.jsonb("terms").notNullable().defaultTo("{}");
    table.decimal("contingency_pct", 6, 2).notNullable().defaultTo(0);
    table.text("tax_label");
    table.decimal("tax_pct", 6, 2).notNullable().defaultTo(0);
    table.text("created_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["org_id", "name"]);
  });
  await knex.raw(
    `ALTER TABLE proposal_templates ADD CONSTRAINT proposal_templates_job_profile_check CHECK (job_profile IN (${check(JOB_PROFILES)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("proposal_templates");
  await knex.raw("ALTER TABLE precon_compliance_docs DROP CONSTRAINT IF EXISTS precon_compliance_docs_doc_type_check");
  await knex.schema.alterTable("precon_compliance_docs", (table) => {
    table.dropColumn("expired_notified_at");
    table.dropColumn("expiring_notified_at");
    table.dropColumn("file_id");
    table.dropColumn("notes");
    table.dropColumn("reference");
  });
  await knex.schema.dropTableIfExists("precon_quote_sources");
  await knex.schema.dropTableIfExists("precon_rate_buildups");
  await knex.schema.alterTable("precon_rates", (table) => {
    table.dropColumn("label");
  });
  await knex.schema.alterTable("precon_rate_cards", (table) => {
    table.dropColumn("is_default");
  });
}
