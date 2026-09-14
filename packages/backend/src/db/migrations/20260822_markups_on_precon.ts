import type { Knex } from "knex";

/** Columns that together anchor a markup to a project drawing revision. */
const PROJECT_ANCHOR = ["project_id", "document_id", "document_version_id", "page_no"] as const;
/** Columns that together anchor a markup to a pre-construction take-off sheet. */
const PRECON_ANCHOR = ["precon_session_id", "precon_sheet_id"] as const;

const allSet = (cols: readonly string[]) => cols.map((c) => `${c} IS NOT NULL`).join(" AND ");
const allNull = (cols: readonly string[]) => cols.map((c) => `${c} IS NULL`).join(" AND ");

/**
 * Exactly one anchor set is present: a project drawing revision, or a
 * pre-construction session + sheet (the row link is optional on that side).
 * Mixing the two would let a pin float between a proposal and a project.
 */
export const ANCHOR_CHECK = `(${allSet(PROJECT_ANCHOR)} AND ${allNull([...PRECON_ANCHOR, "precon_row_id"])}) OR (${allSet(PRECON_ANCHOR)} AND ${allNull(PROJECT_ANCHOR)})`;

/**
 * Markups on take-off sheets.
 *
 * A pinned comment on a pre-construction sheet reuses the drawing-markup
 * register rather than growing a second comments concept: it anchors to the
 * take-off session (the revision it was raised against), the sheet, and
 * optionally the bill line it questions, so the line can show "1 open comment"
 * and clear it when the pin is resolved.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("drawing_markups", (table) => {
    table.text("precon_session_id").references("id").inTable("precon_sessions").onDelete("CASCADE");
    table.text("precon_sheet_id").references("id").inTable("precon_sheets").onDelete("CASCADE");
    table.text("precon_row_id").references("id").inTable("precon_boq_rows").onDelete("SET NULL");
    table.text("project_id").nullable().alter();
    table.text("document_id").nullable().alter();
    table.text("document_version_id").nullable().alter();
    table.integer("page_no").nullable().alter();
    table.index(["precon_session_id", "created_at"]);
    table.index(["precon_sheet_id"]);
  });
  await knex.raw(`ALTER TABLE drawing_markups ADD CONSTRAINT drawing_markups_anchor_check CHECK (${ANCHOR_CHECK})`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE drawing_markups DROP CONSTRAINT IF EXISTS drawing_markups_anchor_check");
  // Precon-anchored rows cannot satisfy the project NOT NULLs being restored.
  await knex("drawing_markups").whereNotNull("precon_session_id").delete();
  await knex.schema.alterTable("drawing_markups", (table) => {
    table.dropIndex(["precon_sheet_id"]);
    table.dropIndex(["precon_session_id", "created_at"]);
    table.dropColumn("precon_row_id");
    table.dropColumn("precon_sheet_id");
    table.dropColumn("precon_session_id");
    table.text("project_id").notNullable().alter();
    table.text("document_id").notNullable().alter();
    table.text("document_version_id").notNullable().alter();
    table.integer("page_no").notNullable().defaultTo(1).alter();
  });
}
