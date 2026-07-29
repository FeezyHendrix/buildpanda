import type { Knex } from "knex";

// Finance records gain an optional-by-intent, NOT-NULL-by-storage building_id so
// per-building spend reconciles exactly against the single project pool. The
// pool (project_finances) is unchanged and stays 1:1 with the project. Existing
// records default to the project's shared sentinel building ("project-wide"),
// so the sum across every building including Shared equals the pool total — no
// nullable ambiguity, no leaking bucket.

async function attribute(knex: Knex, tableRef: string): Promise<void> {
  await knex.raw(`ALTER TABLE ${tableRef} ADD COLUMN building_id text REFERENCES buildings(id) ON DELETE CASCADE`);
  await knex.raw(`
    UPDATE ${tableRef} t
    SET building_id = (SELECT b.id FROM buildings b WHERE b.project_id = t.project_id AND b.kind = 'shared')
  `);
  await knex.raw(`ALTER TABLE ${tableRef} ALTER COLUMN building_id SET NOT NULL`);
  await knex.raw(`CREATE INDEX ${tableRef}_project_building_idx ON ${tableRef} (project_id, building_id)`);
}

export async function up(knex: Knex): Promise<void> {
  await attribute(knex, "milestone_payments");
  await attribute(knex, "budget_phases");
  await attribute(knex, "payment_ledger");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE payment_ledger DROP COLUMN building_id`);
  await knex.raw(`ALTER TABLE budget_phases DROP COLUMN building_id`);
  await knex.raw(`ALTER TABLE milestone_payments DROP COLUMN building_id`);
}
