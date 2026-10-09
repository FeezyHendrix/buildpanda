import type { Knex } from "knex";

export async function up(db: Knex): Promise<void> {
  await db.schema.alterTable("project_updates", (table) => {
    table.text("stage_id").nullable().references("id").inTable("project_phases").onDelete("SET NULL");
    table.index(["project_id", "stage_id"]);
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.alterTable("project_updates", (table) => {
    table.dropIndex(["project_id", "stage_id"]);
    table.dropColumn("stage_id");
  });
}
