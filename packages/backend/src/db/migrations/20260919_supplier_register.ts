import type { Knex } from "knex";

/**
 * A supplier register belongs to the company, not to one job: Dangote and
 * Federated Steel are accounts a contractor buys from on every project. So
 * `project_id` becomes nullable and `organization_id` carries the company
 * scope; a project-created supplier keeps its project_id and is still listed
 * on that project. A QS keeps the register by trade, with approved status,
 * lead time and payment terms.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("suppliers", (table) => {
    table.text("trade");
    table.boolean("approved").notNullable().defaultTo(false);
    table.integer("lead_time_days");
    table.text("payment_terms");
    table
      .text("organization_id")
      .references("id")
      .inTable("organization")
      .onDelete("CASCADE");
    table.index(["organization_id", "active"]);
  });

  await knex.raw("ALTER TABLE suppliers ALTER COLUMN project_id DROP NOT NULL");

  // Backfill the company scope from the project each supplier was typed on, so
  // an existing register becomes company-wide without re-keying.
  await knex.raw(`
    UPDATE suppliers
    SET organization_id = projects.organization_id
    FROM projects
    WHERE suppliers.project_id = projects.id
      AND suppliers.organization_id IS NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  // A supplier created at company level has no project to fall back to; it
  // cannot survive a column that must be NOT NULL.
  await knex("suppliers").whereNull("project_id").del();
  await knex.raw("ALTER TABLE suppliers ALTER COLUMN project_id SET NOT NULL");
  await knex.schema.alterTable("suppliers", (table) => {
    table.dropIndex(["organization_id", "active"]);
    table.dropColumn("organization_id");
    table.dropColumn("payment_terms");
    table.dropColumn("lead_time_days");
    table.dropColumn("approved");
    table.dropColumn("trade");
  });
}
