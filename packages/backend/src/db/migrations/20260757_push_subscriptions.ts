import type { Knex } from "knex";

/**
 * Web push subscriptions: one row per browser/device endpoint a user has
 * granted push permission on. The endpoint is globally unique (it identifies
 * the browser's push-service registration), so upserts key on it.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("push_subscriptions", (table) => {
    table.text("id").primary();
    table.text("user_id").notNullable().references("id").inTable("user").onDelete("CASCADE");
    table.text("endpoint").notNullable().unique();
    table.text("p256dh").notNullable();
    table.text("auth").notNullable();
    table.text("user_agent");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("last_used_at", { useTz: true });
    table.index(["user_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("push_subscriptions");
}
