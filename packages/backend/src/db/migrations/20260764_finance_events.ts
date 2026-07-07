import type { Knex } from "knex";

const TYPES = [
  "deposit",
  "milestone_released",
  "milestone_created",
  "milestone_updated",
  "milestone_deleted",
  "dispute_raised",
] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("finance_events", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("type").notNullable();
    table.text("actor_id");
    table.text("actor_name").notNullable();
    table.text("summary").notNullable();
    table.decimal("amount", 14, 2);
    table.text("entity_id");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE finance_events ADD CONSTRAINT finance_events_type_check CHECK (type IN (${TYPES.map((t) => `'${t}'`).join(", ")}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("finance_events");
}
