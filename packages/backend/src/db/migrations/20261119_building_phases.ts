import type { Knex } from "knex";

/**
 * Building phases group build stages on the Stages page ("Sub-structure",
 * "Services", ...). The stages themselves live in `project_phases` (an older
 * name), which is why the grouping table is `building_phases` and the stage's
 * link to it is `project_phases.building_phase_id`.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("building_phases", (t) => {
    t.text("id").primary();
    t.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    // NOT NULL like project_phases.building_id: every stage sits in a building.
    t.text("building_id").notNullable().references("id").inTable("buildings").onDelete("CASCADE");
    t.text("name").notNullable();
    t.integer("sort_order").notNullable().defaultTo(0);
    t.text("created_by").references("id").inTable("user").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index(["project_id", "building_id", "sort_order"]);
  });
  await knex.raw(
    `CREATE UNIQUE INDEX building_phases_name_key ON building_phases (project_id, building_id, lower(name))`,
  );

  await knex.schema.alterTable("project_phases", (t) => {
    t.text("building_phase_id").references("id").inTable("building_phases").onDelete("SET NULL");
    t.index(["building_phase_id", "sort_order"]);
  });

  // Backfill: one "General" phase per building that already has stages, so no
  // existing stage is left outside a phase.
  await knex.raw(`
    INSERT INTO building_phases (id, project_id, building_id, name, sort_order)
    SELECT 'bphase_' || gen_random_uuid(), s.project_id, s.building_id, 'General', 0
    FROM (SELECT DISTINCT project_id, building_id FROM project_phases) s
  `);
  await knex.raw(`
    UPDATE project_phases s
    SET building_phase_id = bp.id
    FROM building_phases bp
    WHERE bp.project_id = s.project_id AND bp.building_id = s.building_id AND bp.name = 'General'
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_phases", (t) => {
    t.dropColumn("building_phase_id");
  });
  await knex.schema.dropTable("building_phases");
}
