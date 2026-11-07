import type { Knex } from "knex";

// Files uploaded straight onto a client approval request (docs/approvals-page-backend.md §2).
// RESTRICT on the file: an approval is a contractual record, so the file it was decided
// against must not vanish underneath it.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("approval_attachments", (table) => {
    table.text("id").primary();
    table.text("approval_id").notNullable().references("id").inTable("approvals").onDelete("CASCADE");
    table.text("file_id").notNullable().references("id").inTable("uploaded_files").onDelete("RESTRICT");
    table.integer("position").notNullable().defaultTo(0);
    table.text("created_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["file_id"]);
    table.index(["approval_id", "position"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("approval_attachments");
}
