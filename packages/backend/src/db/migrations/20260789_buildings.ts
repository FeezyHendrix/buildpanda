import type { Knex } from "knex";

// A project can contain multiple buildings (blocks in an estate) that share one
// funding pool but each run their own programme of work. Every project gets:
//   - one kind='real' building (the default, named after the project), and
//   - one kind='shared' sentinel (id bld_shared_<projectId>, sort_order -1) that
//     owns "project-wide / shared" finance attribution.
// The sentinel is NEVER a user-facing building: repositories filter kind='real'
// for lists/counts/default resolution, so "single-building project" stays
// realBuildings.length === 1.

const BUILDING_KINDS = ["real", "shared"] as const;
const BUILDING_STATUSES = ["planned", "active", "completed", "on_hold"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("buildings", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("code");
    table.text("kind").notNullable().defaultTo("real");
    table.text("status").notNullable().defaultTo("active");
    table.integer("sort_order").notNullable().defaultTo(0);
    table.integer("progress_percent").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["project_id", "name"]);
    table.index(["project_id", "sort_order"]);
  });
  await knex.raw(`ALTER TABLE buildings ADD CONSTRAINT buildings_kind_check CHECK (kind IN (${check(BUILDING_KINDS)}))`);
  await knex.raw(`ALTER TABLE buildings ADD CONSTRAINT buildings_status_check CHECK (status IN (${check(BUILDING_STATUSES)}))`);
  await knex.raw(
    `CREATE UNIQUE INDEX buildings_one_shared_per_project ON buildings (project_id) WHERE kind = 'shared'`,
  );

  await knex.raw(`
    INSERT INTO buildings (id, project_id, name, kind, status, sort_order, progress_percent)
    SELECT
      'bld_' || md5(random()::text || clock_timestamp()::text),
      p.id,
      p.name,
      'real',
      'active',
      0,
      COALESCE(p.progress_percent, 0)
    FROM projects p
  `);
  await knex.raw(`
    INSERT INTO buildings (id, project_id, name, kind, status, sort_order, progress_percent)
    SELECT
      'bld_shared_' || p.id,
      p.id,
      'Shared',
      'shared',
      'active',
      -1,
      0
    FROM projects p
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("buildings");
}
