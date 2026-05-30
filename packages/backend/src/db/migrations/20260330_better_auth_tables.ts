import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("users");

  await knex.schema.createTable("user", (table) => {
    table.text("id").primary();
    table.text("name").notNullable();
    table.text("email").unique().notNullable();
    table.boolean("emailVerified").notNullable().defaultTo(false);
    table.text("image");
    table.timestamp("createdAt").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt").notNullable().defaultTo(knex.fn.now());

    table.text("country");
    table.text("phone");
  });

  await knex.schema.createTable("session", (table) => {
    table.text("id").primary();
    table.text("userId").notNullable().references("id").inTable("user").onDelete("CASCADE");
    table.text("token").unique().notNullable();
    table.timestamp("expiresAt").notNullable();
    table.text("ipAddress");
    table.text("userAgent");
    table.timestamp("createdAt").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt").notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("account", (table) => {
    table.text("id").primary();
    table.text("userId").notNullable().references("id").inTable("user").onDelete("CASCADE");
    table.text("accountId").notNullable();
    table.text("providerId").notNullable();
    table.text("accessToken");
    table.text("refreshToken");
    table.timestamp("accessTokenExpiresAt");
    table.timestamp("refreshTokenExpiresAt");
    table.text("scope");
    table.text("idToken");
    table.text("password");
    table.timestamp("createdAt").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt").notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("verification", (table) => {
    table.text("id").primary();
    table.text("identifier").notNullable();
    table.text("value").notNullable();
    table.timestamp("expiresAt").notNullable();
    table.timestamp("createdAt").defaultTo(knex.fn.now());
    table.timestamp("updatedAt").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("verification");
  await knex.schema.dropTableIfExists("account");
  await knex.schema.dropTableIfExists("session");
  await knex.schema.dropTableIfExists("user");

  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid());
    table.string("name").notNullable();
    table.string("email").unique().notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });
}
