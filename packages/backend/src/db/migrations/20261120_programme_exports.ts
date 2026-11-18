import type { Knex } from "knex";

/**
 * An exported programme is a copy of a contractual record leaving the system,
 * so who took it, in which format and when is kept, not just logged.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("programme_exports", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("building_id");
    table.text("format").notNullable();
    table.integer("activity_count").notNullable();
    table.text("exported_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("programme_exports");
}
