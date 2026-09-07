import type { Knex } from "knex";

const KINDS = ["client", "material"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * Standalone Material Approval Requests.
 *
 * A material approval is the same contractual artefact as the client approval
 * we already model — something submitted for sign-off, decided by a named
 * reviewer, stamped with who decided and when, discussed in a comment thread,
 * and chased when it goes stale. Forking a second approvals table would fork
 * that lifecycle (status vocabulary, reviewer stamping, decision chasing,
 * comments, reporting) into two drifting copies.
 *
 * So the approval record stays in `approvals` and gains a `kind` discriminator;
 * only the material-specific facts (what material, how much, from whom, needed
 * when) live in a satellite table keyed by approval_id. `kind` defaults to
 * 'client', which backfills every pre-existing row correctly — they were all
 * client sign-offs — and keeps /projects/:id/approvals returning exactly what
 * it returned before once that endpoint filters on kind = 'client'.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("approvals", (table) => {
    // DEFAULT 'client' is the backfill: every approval raised before this
    // migration was a client sign-off, so no separate UPDATE pass is needed.
    table.text("kind").notNullable().defaultTo("client");
    // The two workflows are listed separately in every surface that reads them,
    // so kind leads the composite after project_id.
    table.index(["project_id", "kind", "status"]);
  });
  await knex.raw(
    `ALTER TABLE approvals ADD CONSTRAINT approvals_kind_check CHECK (kind IN (${check(KINDS)}))`,
  );

  await knex.schema.createTable("material_approval_details", (table) => {
    // Keyed by the approval it details — one row per approval, deleted with it.
    // A detail row without its approval is not a record of anything.
    table
      .text("approval_id")
      .primary()
      .references("id")
      .inTable("approvals")
      .onDelete("CASCADE");
    table.text("material_name").notNullable();
    // Free-text spec/standard the request is asking to be signed off against
    // (grade, finish, BS/EN reference). Not a link to a document revision — the
    // approval's own document_id/document_version_id carry that when a drawing
    // or datasheet is attached.
    table.text("specification");
    table.decimal("quantity", 14, 2).notNullable().defaultTo(0);
    table.text("unit").notNullable().defaultTo("item");
    table.text("supplier");
    // Site delivery date, distinct from approvals.due_date, which is the date
    // the DECISION is needed by. Nullable: a spec is often approved long before
    // a delivery date exists.
    table.text("needed_by");
    // Programme links mirror material_orders exactly, so a material approved
    // here and ordered there hangs off the same phase/activity. SET NULL, not
    // CASCADE: reorganising the programme must not delete a sign-off record.
    table.text("phase_id").references("id").inTable("project_phases").onDelete("SET NULL");
    table.text("activity_id").references("id").inTable("activities").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["phase_id"]);
    table.index(["activity_id"]);
  });
  await knex.raw(
    "ALTER TABLE material_approval_details ADD CONSTRAINT material_approval_details_quantity_check CHECK (quantity >= 0)",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("material_approval_details");
  await knex.raw("ALTER TABLE approvals DROP CONSTRAINT IF EXISTS approvals_kind_check");
  await knex.schema.alterTable("approvals", (table) => {
    table.dropIndex(["project_id", "kind", "status"]);
    table.dropColumn("kind");
  });
}
