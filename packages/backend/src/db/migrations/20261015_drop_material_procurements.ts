import type { Knex } from "knex";

/**
 * material_procurements was the first design's "materials procured" list.
 * Orders, deliveries, the stock ledger and transactions now hold every fact
 * it did; it was only ever written as a copy of a delivered order's cost and
 * no screen or total read it. A BIM "cost item" link pointed at its rows, so
 * those links move to the order the row came from (a cost item is now a
 * material order); a link whose row had no order has nothing to point at.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE bim_element_links l
       SET target_table = 'material_orders', target_id = mp.material_order_id
      FROM material_procurements mp
     WHERE l.target_table = 'material_procurements'
       AND l.target_id = mp.id
       AND mp.material_order_id IS NOT NULL
  `);
  await knex("bim_element_links").where({ target_table: "material_procurements" }).del();
  await knex.schema.dropTable("material_procurements");
}

export async function down(knex: Knex): Promise<void> {
  // The table comes back empty: its rows were copies of order costs.
  await knex.schema.createTable("material_procurements", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("purchased_at").notNullable();
    table.text("receipt").notNullable();
    table.decimal("amount", 14, 2).notNullable();
    table.text("thumbnail_tone").notNullable().defaultTo("brand");
    table.integer("sort_order").notNullable().defaultTo(0);
    table.index(["project_id", "sort_order"]);
    table.text("material_order_id").nullable().references("id").inTable("material_orders").onDelete("SET NULL");
  });
}
