import type { Knex } from "knex";

// Preconstruction moved from the project workspace into the sales suite:
// sessions belong to the bidding organization; a project link is optional
// (bids usually precede the project).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.text("org_id").references("id").inTable("organization").onDelete("CASCADE");
    table.text("project_id").nullable().alter();
  });
  await knex.raw(`
    UPDATE precon_sessions
    SET org_id = projects.organization_id
    FROM projects
    WHERE projects.id = precon_sessions.project_id AND precon_sessions.org_id IS NULL
  `);
  // sessions from projects without an organization cannot be reached from the
  // sales suite; none exist outside dev, but guard the NOT NULL anyway
  await knex("precon_sessions").whereNull("org_id").delete();
  await knex.raw(`ALTER TABLE precon_sessions ALTER COLUMN org_id SET NOT NULL`);
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.index(["org_id", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex("precon_sessions").whereNull("project_id").delete();
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.dropIndex(["org_id", "created_at"]);
    table.dropColumn("org_id");
    table.text("project_id").notNullable().alter();
  });
}
