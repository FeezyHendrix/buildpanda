import type { Knex } from "knex";

/**
 * A contractor's site diary follows the company's own form — manpower by
 * trade, plant on site, deliveries, visitors, HSE incidents — not a blank page.
 * Templates are the company's reference data: owned by the organisation (every
 * job fills the same form) with an optional project-only form for a job that
 * reports differently, the way inspection categories are scoped.
 *
 * An entry made from a template keeps a snapshot of the fields it was filled
 * against plus the typed answers. The diary is a contractual record: editing
 * the form next month must not rewrite what was recorded last month. The entry
 * still carries rendered body_html/body_text, so every reader of the diary
 * (PDF report, period report, digest, Panda AI) works unchanged.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("daily_log_templates", (table) => {
    table.text("id").primary();
    // Exactly one owner: the organisation's library, or a single project.
    table.text("organization_id").references("id").inTable("organization").onDelete("CASCADE");
    table.text("project_id").references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("description");
    table.jsonb("fields").notNullable().defaultTo("[]");
    table.boolean("is_default").notNullable().defaultTo(false);
    table.boolean("active").notNullable().defaultTo(true);
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamps(true, true);
    table.index(["organization_id"]);
    table.index(["project_id"]);
  });

  await knex.raw(
    `ALTER TABLE daily_log_templates ADD CONSTRAINT daily_log_templates_one_owner
       CHECK ((organization_id IS NULL) <> (project_id IS NULL))`,
  );
  await knex.raw(
    `CREATE UNIQUE INDEX daily_log_templates_org_name_idx
       ON daily_log_templates (organization_id, lower(name))
     WHERE organization_id IS NOT NULL`,
  );
  await knex.raw(
    `CREATE UNIQUE INDEX daily_log_templates_project_name_idx
       ON daily_log_templates (project_id, lower(name))
     WHERE project_id IS NOT NULL`,
  );

  await knex.schema.alterTable("daily_log_entries", (table) => {
    table
      .text("template_id")
      .references("id")
      .inTable("daily_log_templates")
      .onDelete("SET NULL");
    table.text("template_name");
    table.jsonb("template_fields");
    table.jsonb("responses");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("daily_log_entries", (table) => {
    table.dropColumn("responses");
    table.dropColumn("template_fields");
    table.dropColumn("template_name");
    table.dropColumn("template_id");
  });
  await knex.schema.dropTableIfExists("daily_log_templates");
}
