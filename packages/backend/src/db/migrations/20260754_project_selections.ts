import type { Knex } from "knex";

const STATUS = ["open", "decided", "cancelled"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * Selections & allowances: the homeowner (client participant) chooses finishes
 * and fixtures (tile, taps, lighting…) from a set of options by a deadline,
 * each selection carrying an allowance budget. Choosing above the allowance
 * produces an overage that the company can turn into a change request.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("project_selections", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("description");
    table.text("category");
    table.decimal("allowance_amount", 14, 2);
    table.text("currency").notNullable().defaultTo("NGN");
    table.date("due_date");
    table.text("status").notNullable().defaultTo("open");
    // FK added after project_selection_options exists (circular reference).
    table.text("chosen_option_id");
    table.text("decided_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("decided_at", { useTz: true });
    table.text("change_request_id").references("id").inTable("change_requests").onDelete("SET NULL");
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "status"]);
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE project_selections ADD CONSTRAINT project_selections_status_check CHECK (status IN (${check(STATUS)}))`,
  );

  await knex.schema.createTable("project_selection_options", (table) => {
    table.text("id").primary();
    table
      .text("selection_id")
      .notNullable()
      .references("id")
      .inTable("project_selections")
      .onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("description");
    table.decimal("price", 14, 2);
    table.integer("sort_order").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["selection_id"]);
  });

  await knex.raw(
    `ALTER TABLE project_selections
       ADD CONSTRAINT project_selections_chosen_option_fk
       FOREIGN KEY (chosen_option_id) REFERENCES project_selection_options(id) ON DELETE SET NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    "ALTER TABLE project_selections DROP CONSTRAINT IF EXISTS project_selections_chosen_option_fk",
  );
  await knex.schema.dropTableIfExists("project_selection_options");
  await knex.schema.dropTableIfExists("project_selections");
}
