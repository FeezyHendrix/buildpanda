import type { Knex } from "knex";

const KNOWN_ROLES = ["client", "architect", "inspector", "guest"] as const;

function check(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    "ALTER TABLE project_participants DROP CONSTRAINT IF EXISTS project_participants_role_check",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex("project_participants")
    .whereNotIn("role", [...KNOWN_ROLES])
    .update({ role: "guest" });
  await knex.raw(
    `ALTER TABLE project_participants ADD CONSTRAINT project_participants_role_check CHECK (role IN (${check(KNOWN_ROLES)}))`,
  );
}
