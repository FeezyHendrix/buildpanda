import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("file_shares", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("document_id").notNullable().references("id").inTable("project_documents").onDelete("CASCADE");
    table.text("token").notNullable().unique();
    table.text("created_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("expires_at", { useTz: true });
    table.timestamp("revoked_at", { useTz: true });
    table.integer("view_count").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["document_id"]);
    table.index(["project_id", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("file_shares");
}
