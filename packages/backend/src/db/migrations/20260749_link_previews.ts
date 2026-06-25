import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("link_previews", (table) => {
    table.text("id").primary();
    table.text("url").notNullable().unique();
    table.text("title");
    table.text("description");
    table.text("image");
    table.text("site_name");
    table.boolean("ok").notNullable().defaultTo(true);
    table.timestamp("fetched_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("link_previews");
}
