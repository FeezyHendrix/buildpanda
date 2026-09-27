import type { Knex } from "knex";

const RETENTION_MODES = ["none", "cash", "bond"] as const;
const CLIENT_DETAIL = ["groups", "lines"] as const;
const SCHEDULE_KINDS = ["advance", "stage"] as const;
const PACK_SECTION_KINDS = [
  "scope",
  "exclusions",
  "assumptions",
  "provisional_sums",
  "warranties",
  "terms",
  "site_survey",
] as const;
const PACK_ORIGINS = ["ai", "manual", "prompt", "template"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

// The revision the client signs carries the money terms and the acceptance
// evidence, so a later revision or a dispute can always be read against what
// was actually offered. Pack sections are the prose of the offer, per section,
// with the origin recorded so an AI draft is never mistaken for a human's text.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("estimates", (table) => {
    table.decimal("retention_pct", 5, 2);
    table.text("retention_mode");
    table.decimal("advance_pct", 5, 2);
    table.decimal("wht_pct", 5, 2);
    table.integer("payment_terms_days");
    table.integer("defects_liability_days");
    table.text("client_visible_detail").notNullable().defaultTo("lines");
    table.text("accepted_ip");
    table.text("accepted_user_agent");
    table.text("accepted_pdf_hash");
    table.text("snapshot_file_id").references("id").inTable("uploaded_files").onDelete("SET NULL");
    table.text("response_message");
  });
  await knex.raw(
    `ALTER TABLE estimates ADD CONSTRAINT estimates_retention_mode_check CHECK (retention_mode IS NULL OR retention_mode IN (${check(RETENTION_MODES)}))`,
  );
  await knex.raw(
    `ALTER TABLE estimates ADD CONSTRAINT estimates_client_visible_detail_check CHECK (client_visible_detail IN (${check(CLIENT_DETAIL)}))`,
  );

  await knex.schema.alterTable("estimate_payment_schedule", (table) => {
    table.text("kind").notNullable().defaultTo("stage");
    table.text("programme_task_id");
  });
  await knex.raw(
    `ALTER TABLE estimate_payment_schedule ADD CONSTRAINT estimate_payment_schedule_kind_check CHECK (kind IN (${check(SCHEDULE_KINDS)}))`,
  );

  await knex.schema.createTable("proposal_pack_sections", (table) => {
    table.text("id").primary();
    table.text("proposal_id").notNullable().references("id").inTable("proposals").onDelete("CASCADE");
    table.text("estimate_id").references("id").inTable("estimates").onDelete("SET NULL");
    table.text("kind").notNullable();
    table.text("body_html").notNullable().defaultTo("");
    table.integer("sort").notNullable().defaultTo(0);
    table.text("origin").notNullable().defaultTo("manual");
    table.text("updated_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["proposal_id", "kind"]);
  });
  await knex.raw(
    `ALTER TABLE proposal_pack_sections ADD CONSTRAINT proposal_pack_sections_kind_check CHECK (kind IN (${check(PACK_SECTION_KINDS)}))`,
  );
  await knex.raw(
    `ALTER TABLE proposal_pack_sections ADD CONSTRAINT proposal_pack_sections_origin_check CHECK (origin IN (${check(PACK_ORIGINS)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("proposal_pack_sections");
  await knex.raw("ALTER TABLE estimate_payment_schedule DROP CONSTRAINT IF EXISTS estimate_payment_schedule_kind_check");
  await knex.schema.alterTable("estimate_payment_schedule", (table) => {
    table.dropColumn("programme_task_id");
    table.dropColumn("kind");
  });
  await knex.raw("ALTER TABLE estimates DROP CONSTRAINT IF EXISTS estimates_client_visible_detail_check");
  await knex.raw("ALTER TABLE estimates DROP CONSTRAINT IF EXISTS estimates_retention_mode_check");
  await knex.schema.alterTable("estimates", (table) => {
    table.dropColumn("response_message");
    table.dropColumn("snapshot_file_id");
    table.dropColumn("accepted_pdf_hash");
    table.dropColumn("accepted_user_agent");
    table.dropColumn("accepted_ip");
    table.dropColumn("client_visible_detail");
    table.dropColumn("defects_liability_days");
    table.dropColumn("payment_terms_days");
    table.dropColumn("wht_pct");
    table.dropColumn("advance_pct");
    table.dropColumn("retention_mode");
    table.dropColumn("retention_pct");
  });
}
