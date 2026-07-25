import type { Knex } from "knex";

// Scopes the programme-of-work cluster to buildings. Seven tables gain a
// NOT NULL building_id (project_phases, activities, tasks, task_boards,
// daily_logs, key_dates, look_aheads); activity_delays and task_columns inherit
// through their parent FK. Composite foreign keys keep a child in the same
// building as its parent (an activity cannot point phase_id/parent at another
// building's row). daily_logs joins building_id into its primary key so two
// buildings can each log the same date.

async function addScoped(knex: Knex, tableRef: string): Promise<void> {
  await knex.raw(`ALTER TABLE ${tableRef} ADD COLUMN building_id text REFERENCES buildings(id) ON DELETE CASCADE`);
  await knex.raw(`
    UPDATE ${tableRef} t
    SET building_id = (SELECT b.id FROM buildings b WHERE b.project_id = t.project_id AND b.kind = 'real')
  `);
  await knex.raw(`ALTER TABLE ${tableRef} ALTER COLUMN building_id SET NOT NULL`);
  await knex.raw(`CREATE INDEX ${tableRef}_project_building_idx ON ${tableRef} (project_id, building_id)`);
}

export async function up(knex: Knex): Promise<void> {
  await addScoped(knex, "project_phases");
  await knex.raw(`ALTER TABLE project_phases ADD CONSTRAINT project_phases_id_building_id_key UNIQUE (id, building_id)`);

  await addScoped(knex, "activities");
  await knex.raw(`ALTER TABLE activities ADD CONSTRAINT activities_id_building_id_key UNIQUE (id, building_id)`);
  await knex.raw(`ALTER TABLE activities DROP CONSTRAINT activities_phase_id_foreign`);
  await knex.raw(`
    ALTER TABLE activities ADD CONSTRAINT activities_phase_building_foreign
    FOREIGN KEY (phase_id, building_id) REFERENCES project_phases (id, building_id) ON DELETE SET NULL
  `);
  await knex.raw(`ALTER TABLE activities DROP CONSTRAINT activities_parent_activity_id_foreign`);
  await knex.raw(`
    ALTER TABLE activities ADD CONSTRAINT activities_parent_building_foreign
    FOREIGN KEY (parent_activity_id, building_id) REFERENCES activities (id, building_id) ON DELETE SET NULL
  `);

  await addScoped(knex, "task_boards");
  await knex.raw(`ALTER TABLE task_boards ADD CONSTRAINT task_boards_id_building_id_key UNIQUE (id, building_id)`);
  await knex.raw(`DROP INDEX task_boards_one_default_per_project`);
  await knex.raw(`CREATE UNIQUE INDEX task_boards_one_default_per_building ON task_boards (project_id, building_id) WHERE is_default`);

  await addScoped(knex, "tasks");
  await knex.raw(`ALTER TABLE tasks DROP CONSTRAINT tasks_board_id_foreign`);
  await knex.raw(`
    ALTER TABLE tasks ADD CONSTRAINT tasks_board_building_foreign
    FOREIGN KEY (board_id, building_id) REFERENCES task_boards (id, building_id) ON DELETE CASCADE
  `);

  await addScoped(knex, "key_dates");
  await addScoped(knex, "look_aheads");

  await knex.raw(`ALTER TABLE daily_log_activities DROP CONSTRAINT daily_log_activities_project_id_log_date_foreign`);
  await knex.raw(`ALTER TABLE daily_log_entries DROP CONSTRAINT daily_log_entries_project_id_log_date_foreign`);
  await knex.raw(`ALTER TABLE daily_logs ADD COLUMN building_id text REFERENCES buildings(id) ON DELETE CASCADE`);
  await knex.raw(`
    UPDATE daily_logs dl
    SET building_id = (SELECT b.id FROM buildings b WHERE b.project_id = dl.project_id AND b.kind = 'real')
  `);
  await knex.raw(`ALTER TABLE daily_logs ALTER COLUMN building_id SET NOT NULL`);
  await knex.raw(`ALTER TABLE daily_logs DROP CONSTRAINT daily_logs_pkey`);
  await knex.raw(`ALTER TABLE daily_logs ADD PRIMARY KEY (project_id, building_id, log_date)`);

  await knex.raw(`ALTER TABLE daily_log_activities ADD COLUMN building_id text`);
  await knex.raw(`
    UPDATE daily_log_activities dla
    SET building_id = (SELECT b.id FROM buildings b WHERE b.project_id = dla.project_id AND b.kind = 'real')
  `);
  await knex.raw(`ALTER TABLE daily_log_activities ALTER COLUMN building_id SET NOT NULL`);
  await knex.raw(`ALTER TABLE daily_log_activities DROP CONSTRAINT daily_log_activities_pkey`);
  await knex.raw(`ALTER TABLE daily_log_activities ADD PRIMARY KEY (project_id, building_id, log_date, activity_id)`);
  await knex.raw(`
    ALTER TABLE daily_log_activities ADD CONSTRAINT daily_log_activities_log_building_foreign
    FOREIGN KEY (project_id, building_id, log_date)
    REFERENCES daily_logs (project_id, building_id, log_date) ON DELETE CASCADE
  `);

  await knex.raw(`ALTER TABLE daily_log_entries ADD COLUMN building_id text`);
  await knex.raw(`
    UPDATE daily_log_entries dle
    SET building_id = (SELECT b.id FROM buildings b WHERE b.project_id = dle.project_id AND b.kind = 'real')
  `);
  await knex.raw(`ALTER TABLE daily_log_entries ALTER COLUMN building_id SET NOT NULL`);
  await knex.raw(`
    ALTER TABLE daily_log_entries ADD CONSTRAINT daily_log_entries_log_building_foreign
    FOREIGN KEY (project_id, building_id, log_date)
    REFERENCES daily_logs (project_id, building_id, log_date) ON DELETE CASCADE
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE daily_log_entries DROP CONSTRAINT daily_log_entries_log_building_foreign`);
  await knex.raw(`ALTER TABLE daily_log_entries DROP COLUMN building_id`);
  await knex.raw(`ALTER TABLE daily_log_activities DROP CONSTRAINT daily_log_activities_log_building_foreign`);
  await knex.raw(`ALTER TABLE daily_log_activities DROP CONSTRAINT daily_log_activities_pkey`);
  await knex.raw(`ALTER TABLE daily_log_activities ADD PRIMARY KEY (project_id, log_date, activity_id)`);
  await knex.raw(`ALTER TABLE daily_log_activities DROP COLUMN building_id`);
  await knex.raw(`ALTER TABLE daily_logs DROP CONSTRAINT daily_logs_pkey`);
  await knex.raw(`ALTER TABLE daily_logs ADD PRIMARY KEY (project_id, log_date)`);
  await knex.raw(`ALTER TABLE daily_logs DROP COLUMN building_id`);
  await knex.raw(`
    ALTER TABLE daily_log_activities ADD CONSTRAINT daily_log_activities_project_id_log_date_foreign
    FOREIGN KEY (project_id, log_date) REFERENCES daily_logs (project_id, log_date) ON DELETE CASCADE
  `);
  await knex.raw(`
    ALTER TABLE daily_log_entries ADD CONSTRAINT daily_log_entries_project_id_log_date_foreign
    FOREIGN KEY (project_id, log_date) REFERENCES daily_logs (project_id, log_date) ON DELETE CASCADE
  `);

  await knex.raw(`ALTER TABLE look_aheads DROP COLUMN building_id`);
  await knex.raw(`ALTER TABLE key_dates DROP COLUMN building_id`);

  await knex.raw(`ALTER TABLE tasks DROP CONSTRAINT tasks_board_building_foreign`);
  await knex.raw(`ALTER TABLE tasks ADD CONSTRAINT tasks_board_id_foreign FOREIGN KEY (board_id) REFERENCES task_boards (id) ON DELETE CASCADE`);
  await knex.raw(`ALTER TABLE tasks DROP COLUMN building_id`);

  await knex.raw(`DROP INDEX task_boards_one_default_per_building`);
  await knex.raw(`CREATE UNIQUE INDEX task_boards_one_default_per_project ON task_boards (project_id) WHERE is_default`);
  await knex.raw(`ALTER TABLE task_boards DROP CONSTRAINT task_boards_id_building_id_key`);
  await knex.raw(`ALTER TABLE task_boards DROP COLUMN building_id`);

  await knex.raw(`ALTER TABLE activities DROP CONSTRAINT activities_parent_building_foreign`);
  await knex.raw(`ALTER TABLE activities ADD CONSTRAINT activities_parent_activity_id_foreign FOREIGN KEY (parent_activity_id) REFERENCES activities (id) ON DELETE SET NULL`);
  await knex.raw(`ALTER TABLE activities DROP CONSTRAINT activities_phase_building_foreign`);
  await knex.raw(`ALTER TABLE activities ADD CONSTRAINT activities_phase_id_foreign FOREIGN KEY (phase_id) REFERENCES project_phases (id) ON DELETE SET NULL`);
  await knex.raw(`ALTER TABLE activities DROP CONSTRAINT activities_id_building_id_key`);
  await knex.raw(`ALTER TABLE activities DROP COLUMN building_id`);

  await knex.raw(`ALTER TABLE project_phases DROP CONSTRAINT project_phases_id_building_id_key`);
  await knex.raw(`ALTER TABLE project_phases DROP COLUMN building_id`);
}
