import type { Knex } from "knex";

const LIKELIHOODS = ["low", "medium", "high"] as const;
const IMPACTS = ["low", "medium", "high"] as const;
const RISK_STATUSES = ["open", "mitigated", "closed"] as const;
const ORIGINS = ["ai", "manual", "prompt"] as const;
const DOC_STATUSES = ["draft", "edited", "confirmed"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * Pre-construction safety pack. Risks move from a project-only, three-field
 * list to a register that can live on a proposal before there is a project:
 * likelihood x impact, owner, mitigation, status, review date, and who confirmed
 * the AI's draft. Method statements and the construction phase plan are new,
 * editable tables (never PDFs) that Panda AI drafts and a person finishes.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("risk_factors", (table) => {
    table.text("proposal_id").references("id").inTable("proposals").onDelete("CASCADE");
    table.text("likelihood");
    table.text("impact");
    table.text("owner_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("owner_name");
    table.text("mitigation");
    table.text("status").notNullable().defaultTo("open");
    table.date("review_date");
    table.text("origin").notNullable().defaultTo("manual");
    table.text("confirmed_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("confirmed_at", { useTz: true });
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["proposal_id", "created_at"]);
  });
  await knex.raw(`ALTER TABLE risk_factors ALTER COLUMN project_id DROP NOT NULL`);
  await knex.raw(
    `ALTER TABLE risk_factors ADD CONSTRAINT risk_factors_scope_check CHECK (project_id IS NOT NULL OR proposal_id IS NOT NULL)`,
  );
  await knex.raw(
    `ALTER TABLE risk_factors ADD CONSTRAINT risk_factors_likelihood_check CHECK (likelihood IS NULL OR likelihood IN (${check(LIKELIHOODS)}))`,
  );
  await knex.raw(
    `ALTER TABLE risk_factors ADD CONSTRAINT risk_factors_impact_check CHECK (impact IS NULL OR impact IN (${check(IMPACTS)}))`,
  );
  await knex.raw(
    `ALTER TABLE risk_factors ADD CONSTRAINT risk_factors_status_check CHECK (status IN (${check(RISK_STATUSES)}))`,
  );
  await knex.raw(
    `ALTER TABLE risk_factors ADD CONSTRAINT risk_factors_origin_check CHECK (origin IN (${check(ORIGINS)}))`,
  );

  await knex.schema.createTable("method_statements", (table) => {
    table.text("id").primary();
    table.text("proposal_id").references("id").inTable("proposals").onDelete("CASCADE");
    table.text("project_id").references("id").inTable("projects").onDelete("CASCADE");
    table.text("activity_name").notNullable();
    table.text("programme_task_id");
    table.text("activity_id");
    table.jsonb("hazards").notNullable().defaultTo("[]");
    table.jsonb("steps").notNullable().defaultTo("[]");
    table.text("origin").notNullable().defaultTo("manual");
    table.text("status").notNullable().defaultTo("draft");
    table.text("confirmed_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("confirmed_at", { useTz: true });
    table.text("created_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["proposal_id", "created_at"]);
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE method_statements ADD CONSTRAINT method_statements_scope_check CHECK (project_id IS NOT NULL OR proposal_id IS NOT NULL)`,
  );
  await knex.raw(
    `ALTER TABLE method_statements ADD CONSTRAINT method_statements_origin_check CHECK (origin IN (${check(ORIGINS)}))`,
  );
  await knex.raw(
    `ALTER TABLE method_statements ADD CONSTRAINT method_statements_status_check CHECK (status IN (${check(DOC_STATUSES)}))`,
  );

  await knex.schema.createTable("construction_phase_plans", (table) => {
    table.text("id").primary();
    table.text("proposal_id").unique().references("id").inTable("proposals").onDelete("CASCADE");
    table.text("project_id").unique().references("id").inTable("projects").onDelete("CASCADE");
    table.text("key_dates_note");
    table.text("site_rules");
    table.text("welfare");
    table.text("first_aid");
    table.text("services_isolation");
    table.text("asbestos_note");
    table.jsonb("hazards").notNullable().defaultTo("[]");
    table.text("supervision");
    table.jsonb("emergency_contacts").notNullable().defaultTo("[]");
    table.text("origin").notNullable().defaultTo("manual");
    table.text("status").notNullable().defaultTo("draft");
    table.text("confirmed_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("confirmed_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(
    `ALTER TABLE construction_phase_plans ADD CONSTRAINT construction_phase_plans_scope_check CHECK (project_id IS NOT NULL OR proposal_id IS NOT NULL)`,
  );
  await knex.raw(
    `ALTER TABLE construction_phase_plans ADD CONSTRAINT construction_phase_plans_origin_check CHECK (origin IN (${check(ORIGINS)}))`,
  );
  await knex.raw(
    `ALTER TABLE construction_phase_plans ADD CONSTRAINT construction_phase_plans_status_check CHECK (status IN (${check(DOC_STATUSES)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("construction_phase_plans");
  await knex.schema.dropTableIfExists("method_statements");
  await knex.raw(`ALTER TABLE risk_factors DROP CONSTRAINT IF EXISTS risk_factors_origin_check`);
  await knex.raw(`ALTER TABLE risk_factors DROP CONSTRAINT IF EXISTS risk_factors_status_check`);
  await knex.raw(`ALTER TABLE risk_factors DROP CONSTRAINT IF EXISTS risk_factors_impact_check`);
  await knex.raw(`ALTER TABLE risk_factors DROP CONSTRAINT IF EXISTS risk_factors_likelihood_check`);
  await knex.raw(`ALTER TABLE risk_factors DROP CONSTRAINT IF EXISTS risk_factors_scope_check`);
  await knex("risk_factors").whereNull("project_id").delete();
  await knex.raw(`ALTER TABLE risk_factors ALTER COLUMN project_id SET NOT NULL`);
  await knex.schema.alterTable("risk_factors", (table) => {
    table.dropIndex(["proposal_id", "created_at"]);
    table.dropColumn("updated_at");
    table.dropColumn("confirmed_at");
    table.dropColumn("confirmed_by");
    table.dropColumn("origin");
    table.dropColumn("review_date");
    table.dropColumn("status");
    table.dropColumn("mitigation");
    table.dropColumn("owner_name");
    table.dropColumn("owner_id");
    table.dropColumn("impact");
    table.dropColumn("likelihood");
    table.dropColumn("proposal_id");
  });
}
