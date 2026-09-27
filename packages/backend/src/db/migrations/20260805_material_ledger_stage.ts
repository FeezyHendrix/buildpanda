import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("material_ledger_entries", (table) => {
    // Nullable on purpose: entries predate this, and a crew logging a delivery
    // offline at 7am often cannot say which stage it belongs to yet.
    table
      .text("stage_id")
      .nullable()
      .references("id")
      .inTable("project_phases")
      // SET NULL, not CASCADE as invoice_stage_lines uses. An invoice line is
      // meaningless without its stage; a ledger entry records a physical fact
      // that stays true if the programme is reorganised. Cascading here would
      // delete audit history to tidy up a schedule.
      .onDelete("SET NULL");
    table.index(["project_id", "stage_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("material_ledger_entries", (table) => {
    table.dropIndex(["project_id", "stage_id"]);
    table.dropColumn("stage_id");
  });
}
