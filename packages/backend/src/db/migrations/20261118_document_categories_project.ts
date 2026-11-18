import type { Knex } from "knex";

/**
 * Document categories become project-scoped and attributed.
 *
 * - project_id null = a global category every project sees (the seeded rows);
 *   non-null = a category a member added inside that project.
 * - created_by / created_at record who added it and when.
 * - name was unique across the whole table, which would stop two projects both
 *   adding "Legal". Global names stay unique; a project's names are unique per
 *   group, compared case-insensitively.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("document_categories", (table) => {
    table.text("project_id").references("id").inTable("projects").onDelete("CASCADE");
    table.text("created_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.dropUnique(["name"]);
    table.index(["project_id", "group"]);
  });
  await knex.raw(
    `CREATE UNIQUE INDEX document_categories_global_name_unique
       ON document_categories (name) WHERE project_id IS NULL`,
  );
  await knex.raw(
    `CREATE UNIQUE INDEX document_categories_project_name_unique
       ON document_categories (project_id, "group", lower(name)) WHERE project_id IS NOT NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  // Project categories cannot survive without project_id: left behind they would
  // become global. Their documents keep existing, uncategorised (FK is SET NULL).
  await knex("document_categories").whereNotNull("project_id").del();
  await knex.raw("DROP INDEX IF EXISTS document_categories_project_name_unique");
  await knex.raw("DROP INDEX IF EXISTS document_categories_global_name_unique");
  await knex.schema.alterTable("document_categories", (table) => {
    table.dropIndex(["project_id", "group"]);
    table.dropColumn("project_id");
    table.dropColumn("created_by");
    table.dropColumn("created_at");
    table.unique(["name"]);
  });
}
