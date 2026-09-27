import type { Knex } from "knex";

/**
 * An expense stays a non-negative figure (the amount check already enforces
 * that); a refund is recorded as a CREDIT against the same stage and category
 * instead of a negative number, and a refundable outlay — a plant-hire deposit,
 * a utility bond — is flagged `recoverable` so it does not sit in used cost for
 * ever.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_transactions", (table) => {
    table.boolean("credit").notNullable().defaultTo(false);
    table.boolean("recoverable").notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_transactions", (table) => {
    table.dropColumn("credit");
    table.dropColumn("recoverable");
  });
}
