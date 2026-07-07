import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("org_data_commitments", (table) => {
    table.text("id").primary();
    table.text("org_id").notNullable().references("id").inTable("organization").onDelete("CASCADE");
    table.text("version").notNullable();
    table.text("accepted_by_user_id");
    table.text("accepted_by_name").notNullable();
    table.timestamp("accepted_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["org_id", "version"]);
    table.index(["org_id", "accepted_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("org_data_commitments");
}
