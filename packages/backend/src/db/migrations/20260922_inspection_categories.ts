import type { Knex } from "knex";

/**
 * What a company inspects is its own reference data, not a constant in our
 * code: a road contractor holds formation, drainage and pavement; a fit-out
 * contractor holds joinery and MEP. The list was a CHECK constraint, so adding
 * a category meant a migration.
 *
 * Categories belong to the organisation (every project in it draws from the
 * same list) with an optional project override for a one-off on a single job,
 * the way suppliers are scoped. They are archived, never deleted, because an
 * inspection keeps its category for the life of the file.
 */

const SEED = [
  "Earthworks & formation",
  "Drainage",
  "Pavement",
  "Materials testing",
  "Structural",
  "Safety",
  "Quantity Survey",
  "General Progress",
  "Electrical",
  "Plumbing",
] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("inspection_categories", (table) => {
    table.text("id").primary();
    // Exactly one owner: an org list, or a single project's own addition.
    table.text("organization_id").references("id").inTable("organization").onDelete("CASCADE");
    table.text("project_id").references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable();
    table.integer("sort_order").notNullable().defaultTo(0);
    table.boolean("active").notNullable().defaultTo(true);
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamps(true, true);
    table.index(["organization_id"]);
    table.index(["project_id"]);
  });

  // A name is unique within its list, so two "Drainage" rows cannot appear in
  // the same picker. Partial indexes keep org and project lists independent.
  await knex.raw(
    `CREATE UNIQUE INDEX inspection_categories_org_name_idx
       ON inspection_categories (organization_id, lower(name))
     WHERE organization_id IS NOT NULL`,
  );
  await knex.raw(
    `CREATE UNIQUE INDEX inspection_categories_project_name_idx
       ON inspection_categories (project_id, lower(name))
     WHERE project_id IS NOT NULL`,
  );

  await knex.schema.alterTable("inspections", (table) => {
    table
      .text("category_id")
      .references("id")
      .inTable("inspection_categories")
      .onDelete("SET NULL");
    table.index(["category_id"]);
  });

  // The category is free text from here on; the list is data.
  await knex.raw("ALTER TABLE inspections DROP CONSTRAINT IF EXISTS inspections_category_check");

  const organizations = await knex<{ id: string }>("organization").select("id");
  const now = new Date();
  interface SeedRow {
    id: string;
    organization_id: string | null;
    project_id: string | null;
    name: string;
    sort_order: number;
    active: boolean;
    created_at: Date;
    updated_at: Date;
  }
  const rows: SeedRow[] = organizations.flatMap((organization) =>
    SEED.map((name, index) => ({
      id: `insc_${organization.id}_${index}`,
      organization_id: organization.id,
      project_id: null,
      name,
      sort_order: index,
      active: true,
      created_at: now,
      updated_at: now,
    })),
  );
  // A workspace-less project (seed data, personal projects) still needs a list.
  rows.push(
    ...SEED.map((name, index) => ({
      id: `insc_global_${index}`,
      organization_id: null,
      project_id: null,
      name,
      sort_order: index,
      active: true,
      created_at: now,
      updated_at: now,
    })),
  );
  if (rows.length > 0) await knex("inspection_categories").insert(rows);

  // Existing inspections keep their category by matching on the name they hold.
  await knex.raw(
    `UPDATE inspections i
        SET category_id = c.id
       FROM inspection_categories c, projects p
      WHERE p.id = i.project_id
        AND lower(c.name) = lower(i.category)
        AND c.project_id IS NULL
        AND (c.organization_id = p.organization_id
             OR (c.organization_id IS NULL AND p.organization_id IS NULL))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("inspections", (table) => {
    table.dropIndex(["category_id"]);
    table.dropColumn("category_id");
  });
  await knex.schema.dropTableIfExists("inspection_categories");
  await knex("inspections").whereNotIn("category", SEED).update({ category: "General Progress" });
  await knex.raw(
    `ALTER TABLE inspections ADD CONSTRAINT inspections_category_check
       CHECK (category IN (${SEED.map((value) => `'${value}'`).join(", ")}))`,
  );
}
