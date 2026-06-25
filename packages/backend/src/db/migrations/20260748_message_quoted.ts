import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("messages", (table) => {
    table.text("quoted_message_id").references("id").inTable("messages").onDelete("SET NULL");
    table.index(["quoted_message_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("messages", (table) => {
    table.dropColumn("quoted_message_id");
  });
}
