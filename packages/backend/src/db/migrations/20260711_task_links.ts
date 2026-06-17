import type { Knex } from "knex";

const LINK_TYPES = ["relates_to", "blocks", "blocked_by", "duplicates"] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("task_links", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("source_task_id").notNullable().references("id").inTable("tasks").onDelete("CASCADE");
    table.text("target_task_id").notNullable().references("id").inTable("tasks").onDelete("CASCADE");
    table.text("link_type").notNullable().defaultTo("relates_to");
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["source_task_id"]);
    table.index(["target_task_id"]);
  });
  const values = LINK_TYPES.map((v) => `'${v}'`).join(", ");
  await knex.raw(`ALTER TABLE task_links ADD CONSTRAINT task_links_type_check CHECK (link_type IN (${values}))`);
  await knex.raw(
    "ALTER TABLE task_links ADD CONSTRAINT task_links_no_self CHECK (source_task_id <> target_task_id)",
  );
  await knex.raw(
    "CREATE UNIQUE INDEX task_links_unique ON task_links (source_task_id, target_task_id, link_type)",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("task_links");
}
