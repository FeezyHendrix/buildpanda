import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("organizationRole", (table) => {
    table.text("id").primary();
    table
      .text("organizationId")
      .notNullable()
      .references("id")
      .inTable("organization")
      .onDelete("CASCADE");
    table.text("role").notNullable();
    table.text("permission").notNullable();
    table.timestamp("createdAt").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt").defaultTo(knex.fn.now());

    table.unique(["organizationId", "role"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("organizationRole");
}
