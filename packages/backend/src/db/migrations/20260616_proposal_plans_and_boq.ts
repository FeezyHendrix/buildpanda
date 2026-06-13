import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("proposal_plans", (table) => {
    table.text("id").primary();
    table.text("proposal_id").notNullable().references("id").inTable("proposals").onDelete("CASCADE");
    table.text("file_id").notNullable().references("id").inTable("uploaded_files").onDelete("CASCADE");
    table.text("label");
    table.text("uploaded_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("uploaded_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.integer("sort").notNullable().defaultTo(0);
    table.index(["proposal_id", "sort"], "proposal_plans_proposal_id_sort_index");
  });

  await knex.schema.createTable("proposal_boq_items", (table) => {
    table.text("id").primary();
    table.text("proposal_id").notNullable().references("id").inTable("proposals").onDelete("CASCADE");
    table.text("group_label").notNullable().defaultTo("General");
    table.text("description").notNullable();
    table.decimal("qty", 12, 3).notNullable().defaultTo(0);
    table.text("unit").notNullable().defaultTo("item");
    table.integer("sort").notNullable().defaultTo(0);
    table.index(["proposal_id", "sort"], "proposal_boq_items_proposal_id_sort_index");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("proposal_boq_items");
  await knex.schema.dropTableIfExists("proposal_plans");
}
