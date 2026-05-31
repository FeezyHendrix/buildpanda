import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("organization", (table) => {
    table.text("id").primary();
    table.text("name").notNullable();
    table.text("slug").unique().notNullable();
    table.text("logo");
    table.text("metadata");
    table.timestamp("createdAt").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt").defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("member", (table) => {
    table.text("id").primary();
    table
      .text("organizationId")
      .notNullable()
      .references("id")
      .inTable("organization")
      .onDelete("CASCADE");
    table
      .text("userId")
      .notNullable()
      .references("id")
      .inTable("user")
      .onDelete("CASCADE");
    table.text("role").notNullable().defaultTo("member");
    table.timestamp("createdAt").notNullable().defaultTo(knex.fn.now());

    table.unique(["organizationId", "userId"]);
  });

  await knex.schema.createTable("invitation", (table) => {
    table.text("id").primary();
    table
      .text("organizationId")
      .notNullable()
      .references("id")
      .inTable("organization")
      .onDelete("CASCADE");
    table.text("email").notNullable();
    table.text("role");
    table.text("status").notNullable().defaultTo("pending");
    table.timestamp("expiresAt");
    table
      .text("inviterId")
      .notNullable()
      .references("id")
      .inTable("user")
      .onDelete("CASCADE");
    table.timestamp("createdAt").notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable("session", (table) => {
    table.text("activeOrganizationId");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("session", (table) => {
    table.dropColumn("activeOrganizationId");
  });
  await knex.schema.dropTableIfExists("invitation");
  await knex.schema.dropTableIfExists("member");
  await knex.schema.dropTableIfExists("organization");
}
