import type { Knex } from "knex";

/**
 * Adds the columns required by the better-auth `admin` plugin:
 * a global role on the user, ban fields, and session impersonation.
 */
export async function up(knex: Knex): Promise<void> {
  const hasRole = await knex.schema.hasColumn("user", "role");
  await knex.schema.alterTable("user", (table) => {
    if (!hasRole) table.text("role").notNullable().defaultTo("user");
    table.boolean("banned").notNullable().defaultTo(false);
    table.text("banReason").nullable();
    table.timestamp("banExpires", { useTz: true }).nullable();
  });

  await knex.schema.alterTable("session", (table) => {
    table.text("impersonatedBy").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("session", (table) => {
    table.dropColumn("impersonatedBy");
  });
  await knex.schema.alterTable("user", (table) => {
    table.dropColumn("role");
    table.dropColumn("banned");
    table.dropColumn("banReason");
    table.dropColumn("banExpires");
  });
}
