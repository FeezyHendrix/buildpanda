import type { Knex } from "knex";

/**
 * Measuring the same drawing with the same scope again makes a new revision
 * of that take-off, not an unrelated sibling: the earlier session is kept for
 * the audit trail and points at the session that replaced it. Existing
 * sessions are numbered in creation order per (plan, scope) and all but the
 * latest are marked superseded.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.integer("revision").notNullable().defaultTo(1);
    table.string("superseded_by").references("id").inTable("precon_sessions").onDelete("SET NULL");
  });
  await knex.raw(`
    WITH ranked AS (
      SELECT id,
             row_number() OVER w AS rev,
             first_value(id) OVER (PARTITION BY plan_id, scope->>'kind', COALESCE(scope->>'elements', '')
                                   ORDER BY created_at DESC, id DESC) AS latest
      FROM precon_sessions
      WHERE plan_id IS NOT NULL
      WINDOW w AS (PARTITION BY plan_id, scope->>'kind', COALESCE(scope->>'elements', '') ORDER BY created_at ASC, id ASC)
    )
    UPDATE precon_sessions s
    SET revision = ranked.rev,
        superseded_by = CASE WHEN ranked.latest = s.id THEN NULL ELSE ranked.latest END
    FROM ranked
    WHERE ranked.id = s.id
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.dropColumn("superseded_by");
    table.dropColumn("revision");
  });
}
