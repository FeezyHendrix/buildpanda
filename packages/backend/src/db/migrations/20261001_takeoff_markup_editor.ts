import type { Knex } from "knex";

/**
 * Markup editor: optimistic concurrency, soft delete and ink style.
 *
 * Additive only. A redline and the thread hanging off it are contractual
 * records, so the editor needs the same three things the bill lines already
 * have:
 *
 *   * `version` — two people redlining the same sheet must collide loudly, not
 *     silently overwrite each other (the pattern `precon_boq_rows.version`
 *     already uses).
 *   * `deleted_at` — a redline withdrawn after an RFI was raised off it still
 *     has to be recoverable in a dispute; it is hidden, not erased.
 *   * `style` — pen colour and stroke width as drawn. The single `color`
 *     column cannot record a fine annotation next to a heavy cloud, so the
 *     stroke silently re-renders at the viewer's default width.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("drawing_markups", (table) => {
    table.integer("version").notNullable().defaultTo(1);
    table.timestamp("deleted_at", { useTz: true });
    table.jsonb("style");
  });

  await knex.schema.alterTable("drawing_markup_comments", (table) => {
    table.integer("version").notNullable().defaultTo(1);
    table.timestamp("deleted_at", { useTz: true });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("drawing_markup_comments", (table) => {
    table.dropColumn("deleted_at");
    table.dropColumn("version");
  });

  await knex.schema.alterTable("drawing_markups", (table) => {
    table.dropColumn("style");
    table.dropColumn("deleted_at");
    table.dropColumn("version");
  });
}
