import type { Knex } from "knex";

/**
 * Approvals as a record, not an overwrite (docs/approvals-page-backend.md §2, §5).
 *
 *   * `approvals.revision` — bumped each time the requester resubmits after
 *     "Changes requested"; everything decided or attached is stamped with it.
 *   * `approval_attachments` also takes a document version (pinned, never
 *     "latest"), and keeps every revision's files so a decision can be read
 *     against exactly what it was made on. The approval's own document_id /
 *     document_version_id (the raise-from-markup flow) becomes revision 1's
 *     first attachment.
 *   * `approval_decisions` — append-only: one row per decision, with the note
 *     and who made it. The denormalised latest decision stays on `approvals`.
 *   * `approval_categories` — per-project list behind the form's Category
 *     picker; the approval itself keeps `category` as free text for history.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("approvals", (table) => {
    table.integer("revision").notNullable().defaultTo(1);
  });

  await knex.schema.alterTable("approval_attachments", (table) => {
    // A file may now appear in several revisions of the same approval; the
    // "not attached elsewhere" rule moves to the service.
    table.dropUnique(["file_id"]);
    table.index(["file_id"]);
    table.text("file_id").nullable().alter();
    table.text("document_id").references("id").inTable("project_documents").onDelete("CASCADE");
    table.text("document_version_id").references("id").inTable("document_versions").onDelete("CASCADE");
    table.integer("revision").notNullable().defaultTo(1);
  });
  await knex.raw(`ALTER TABLE approval_attachments
    ADD CONSTRAINT approval_attachments_source_check
    CHECK (file_id IS NOT NULL OR (document_id IS NOT NULL AND document_version_id IS NOT NULL))`);

  await knex.raw(`INSERT INTO approval_attachments (id, approval_id, document_id, document_version_id, position, created_by, created_at, revision)
    SELECT 'apra_' || substr(md5(a.id), 1, 20), a.id, a.document_id, a.document_version_id, 0, a.submitted_by_id, a.created_at, 1
    FROM approvals a
    WHERE a.kind = 'client' AND a.document_id IS NOT NULL AND a.document_version_id IS NOT NULL`);

  await knex.schema.createTable("approval_decisions", (table) => {
    table.text("id").primary();
    table.text("approval_id").notNullable().references("id").inTable("approvals").onDelete("CASCADE");
    table.text("decision").notNullable();
    table.text("note");
    table.text("note_html");
    table.text("actor_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("decided_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.integer("revision").notNullable().defaultTo(1);
    table.index(["approval_id", "decided_at"]);
  });
  // Decisions already on the books become the first history row.
  await knex.raw(`INSERT INTO approval_decisions (id, approval_id, decision, note, note_html, actor_id, decided_at, revision)
    SELECT 'aprd_' || substr(md5(a.id), 1, 20), a.id, a.status, a.response, a.response_html, a.reviewed_by_id, a.reviewed_at, 1
    FROM approvals a
    WHERE a.kind = 'client' AND a.reviewed_at IS NOT NULL AND a.status IN ('Approved', 'Rejected', 'Resubmit')`);

  await knex.schema.createTable("approval_categories", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable();
    table.integer("position").notNullable().defaultTo(0);
    table.unique(["project_id", "name"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("approval_categories");
  await knex.schema.dropTableIfExists("approval_decisions");
  await knex.raw("ALTER TABLE approval_attachments DROP CONSTRAINT IF EXISTS approval_attachments_source_check");
  await knex("approval_attachments").whereNull("file_id").del();
  await knex.schema.alterTable("approval_attachments", (table) => {
    table.dropColumn("revision");
    table.dropColumn("document_version_id");
    table.dropColumn("document_id");
    table.text("file_id").notNullable().alter();
    table.dropIndex(["file_id"]);
    table.unique(["file_id"]);
  });
  await knex.schema.alterTable("approvals", (table) => {
    table.dropColumn("revision");
  });
}
