import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("llm_prices", (table) => {
    table.text("model_version").notNullable();
    table.decimal("input_per_1k", 12, 6).notNullable();
    table.decimal("output_per_1k", 12, 6).notNullable();
    table
      .timestamp("effective_from", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.timestamp("effective_to", { useTz: true }).nullable();
    table.primary(["model_version", "effective_from"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("llm_prices");
}
