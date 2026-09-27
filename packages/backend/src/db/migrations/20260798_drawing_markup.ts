import type { Knex } from "knex";

const MARKUP_KINDS = ["pin", "pen", "cloud", "measure"] as const;
const MEDIA_KINDS = ["audio", "video"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * Drawing markup register.
 *
 * Markup is anchored to a document_version, not a document: a redline raised
 * against Rev B stays on Rev B when Rev C supersedes it, so a superseded
 * revision's open items can be surfaced instead of silently reappearing on
 * drawings they were never made against.
 *
 * RFIs and approvals gain a drawing reference (document + version + the markup
 * that spawned them). A real RFI form carries "Ref drawing: A-114 Rev C"; the
 * table previously had nowhere to record it.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("drawing_markups", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table
      .text("document_id")
      .notNullable()
      .references("id")
      .inTable("project_documents")
      .onDelete("CASCADE");
    table
      .text("document_version_id")
      .notNullable()
      .references("id")
      .inTable("document_versions")
      .onDelete("CASCADE");
    table.integer("page_no").notNullable().defaultTo(1);
    table.text("kind").notNullable();
    table.jsonb("geometry").notNullable();
    table.text("color").notNullable().defaultTo("#004DE7");
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("resolved_at", { useTz: true });
    table.text("resolved_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["document_version_id", "page_no"]);
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE drawing_markups ADD CONSTRAINT drawing_markups_kind_check CHECK (kind IN (${check(MARKUP_KINDS)}))`,
  );

  await knex.schema.createTable("drawing_markup_comments", (table) => {
    table.text("id").primary();
    table
      .text("markup_id")
      .notNullable()
      .references("id")
      .inTable("drawing_markups")
      .onDelete("CASCADE");
    table.text("body").notNullable();
    table.text("media_kind");
    table.text("file_id").references("id").inTable("uploaded_files").onDelete("SET NULL");
    table.integer("media_duration_seconds");
    table.text("assignee_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["markup_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE drawing_markup_comments ADD CONSTRAINT drawing_markup_comments_media_kind_check CHECK (media_kind IS NULL OR media_kind IN (${check(MEDIA_KINDS)}))`,
  );

  await knex.schema.alterTable("rfis", (table) => {
    table.text("document_id").references("id").inTable("project_documents").onDelete("SET NULL");
    table
      .text("document_version_id")
      .references("id")
      .inTable("document_versions")
      .onDelete("SET NULL");
    table.text("source_markup_id").references("id").inTable("drawing_markups").onDelete("SET NULL");
  });

  await knex.schema.alterTable("approvals", (table) => {
    table.text("document_id").references("id").inTable("project_documents").onDelete("SET NULL");
    table
      .text("document_version_id")
      .references("id")
      .inTable("document_versions")
      .onDelete("SET NULL");
    table.text("source_markup_id").references("id").inTable("drawing_markups").onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("approvals", (table) => {
    table.dropColumn("source_markup_id");
    table.dropColumn("document_version_id");
    table.dropColumn("document_id");
  });
  await knex.schema.alterTable("rfis", (table) => {
    table.dropColumn("source_markup_id");
    table.dropColumn("document_version_id");
    table.dropColumn("document_id");
  });
  await knex.schema.dropTableIfExists("drawing_markup_comments");
  await knex.schema.dropTableIfExists("drawing_markups");
}
