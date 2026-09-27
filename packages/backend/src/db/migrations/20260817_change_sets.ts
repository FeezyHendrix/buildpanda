import type { Knex } from "knex";

const STATUSES = ["proposed", "applied", "undone", "discarded"] as const;
const SURFACES = ["bill", "programme", "estimate", "pack", "risks"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

// A prompted change set is the unit of "Ask Panda AI": the prompt, the plan the
// model showed, the changes as a diff, and what happened when they were applied,
// so an applied set can be undone as a whole and audited later.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("precon_change_sets", (table) => {
    table.text("id").primary();
    table.text("session_id").references("id").inTable("precon_sessions").onDelete("CASCADE");
    table.text("proposal_id").references("id").inTable("proposals").onDelete("CASCADE");
    table.text("surface").notNullable();
    table.text("prompt").notNullable();
    table.jsonb("plan_json").notNullable();
    table.jsonb("changes").notNullable();
    table.text("status").notNullable().defaultTo("proposed");
    table.jsonb("applied_result");
    table.text("created_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("applied_at", { useTz: true });
    table.index(["session_id", "created_at"]);
    table.index(["proposal_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE precon_change_sets ADD CONSTRAINT precon_change_sets_status_check CHECK (status IN (${check(STATUSES)}))`,
  );
  await knex.raw(
    `ALTER TABLE precon_change_sets ADD CONSTRAINT precon_change_sets_surface_check CHECK (surface IN (${check(SURFACES)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("precon_change_sets");
}
