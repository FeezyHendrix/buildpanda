import type { Knex } from "knex";
import {
  composeParticipantPermissions,
  PARTICIPANT_PERMISSIONS,
  type ProjectSectionPermissions,
} from "../../lib/authorization.ts";

interface Row {
  id: string;
  role: string;
  permissions: Record<string, string> | null;
}

// Moves participant authorization from the (role preset + section matrix) model
// to a raw resource->actions[] grant map. Backfills each existing row with its
// CURRENT composed effective permissions so no participant gains or loses access
// at cutover — including role-default grants the matrix could never express
// (e.g. a client's finances:dispute / approvals:decide). `grants` stays nullable
// here; a later migration makes it NOT NULL once the writer is switched over.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_participants", (table) => {
    table.jsonb("grants").nullable();
  });

  const rows = await knex<Row>("project_participants").select("id", "role", "permissions");
  for (const row of rows) {
    const roleDefaults = PARTICIPANT_PERMISSIONS[row.role];
    const sections = (row.permissions ?? undefined) as
      | ProjectSectionPermissions
      | undefined;
    const grants = composeParticipantPermissions(roleDefaults, sections);
    await knex("project_participants")
      .where({ id: row.id })
      .update({ grants: JSON.stringify(grants) });
  }

  const result = await knex("project_participants")
    .whereNull("grants")
    .count<{ count: string }[]>("* as count");
  const remaining = Number(result[0]?.count ?? 0);
  if (remaining > 0) {
    throw new Error(`participant grants backfill left ${remaining} rows null`);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_participants", (table) => {
    table.dropColumn("grants");
  });
}
