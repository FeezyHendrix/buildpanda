import type { Knex } from "knex";

/**
 * Deleting a stage that still carries activities used to return a 500: the
 * composite `(phase_id, building_id) ON DELETE SET NULL` tried to null
 * `building_id`, which is NOT NULL. RESTRICT states the real rule — activities
 * belong to a stage and have to be reassigned before the stage can go — and the
 * stages service turns it into a 409 that names the count and the value.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_phase_building_foreign");
  await knex.raw(`
    ALTER TABLE activities ADD CONSTRAINT activities_phase_building_foreign
    FOREIGN KEY (phase_id, building_id) REFERENCES project_phases (id, building_id) ON DELETE RESTRICT
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_phase_building_foreign");
  await knex.raw(`
    ALTER TABLE activities ADD CONSTRAINT activities_phase_building_foreign
    FOREIGN KEY (phase_id, building_id) REFERENCES project_phases (id, building_id) ON DELETE SET NULL
  `);
}
