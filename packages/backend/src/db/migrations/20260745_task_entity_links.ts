import type { Knex } from "knex";

const ENTITY_TYPES = [
  "action_item",
  "rfi",
  "change_request",
  "material",
  "invoice",
  "milestone_payment",
] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("task_entity_links", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("task_id").notNullable().references("id").inTable("tasks").onDelete("CASCADE");
    table.text("entity_type").notNullable();
    table.text("entity_id").notNullable();
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["task_id"]);
  });
  const values = ENTITY_TYPES.map((v) => `'${v}'`).join(", ");
  await knex.raw(
    `ALTER TABLE task_entity_links ADD CONSTRAINT task_entity_links_type_check CHECK (entity_type IN (${values}))`,
  );
  await knex.raw(
    "CREATE UNIQUE INDEX task_entity_links_unique ON task_entity_links (task_id, entity_type, entity_id)",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("task_entity_links");
}
