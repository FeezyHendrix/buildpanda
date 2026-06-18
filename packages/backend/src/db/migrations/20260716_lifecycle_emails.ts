import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("lifecycle_emails", (table) => {
    table.text("id").primary();
    table.text("user_id").notNullable().references("id").inTable("user").onDelete("CASCADE");
    table.text("email_type").notNullable();
    table.timestamp("sent_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["user_id", "email_type"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("lifecycle_emails");
}
