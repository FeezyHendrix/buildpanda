import type { Knex } from "knex";

/**
 * Adds revision history to project documents and introduces plan disciplines.
 *
 * - document_versions: full version history per document (Rev A/B/C...).
 * - project_documents.current_version_id: points at the live version; the
 *   existing file_id/file_name/size columns are kept as a mirror of the current
 *   version so existing list endpoints keep working unchanged.
 * - document_categories.group: 'document' (default) or 'plan'. Plan disciplines
 *   (Architectural, Structural, MEP, Civil/Site, Survey) are seeded.
 * - Backfills a version 1 for every existing document that has a file.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("document_versions", (table) => {
    table.text("id").primary();
    table
      .text("document_id")
      .notNullable()
      .references("id")
      .inTable("project_documents")
      .onDelete("CASCADE");
    table.text("file_id").references("id").inTable("uploaded_files").onDelete("SET NULL");
    table.integer("version_no").notNullable();
    table.text("revision_label");
    table.text("file_name").notNullable();
    table.text("size").notNullable();
    table.bigInteger("size_bytes");
    table.text("notes");
    table.text("uploaded_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["document_id", "version_no"]);
    table.index(["document_id", "version_no"]);
  });

  await knex.schema.alterTable("project_documents", (table) => {
    table
      .text("current_version_id")
      .references("id")
      .inTable("document_versions")
      .onDelete("SET NULL");
  });

  const hasGroup = await knex.schema.hasColumn("document_categories", "group");
  if (!hasGroup) {
    await knex.schema.alterTable("document_categories", (table) => {
      table.text("group").notNullable().defaultTo("document");
    });
  }

  // Seed plan disciplines (stable ids; ignore if they already exist).
  const planCategories = [
    { id: "cat_plan_architectural", name: "Architectural", tone: "brand" },
    { id: "cat_plan_structural", name: "Structural", tone: "orange" },
    { id: "cat_plan_mep", name: "MEP", tone: "green" },
    { id: "cat_plan_civil", name: "Civil / Site", tone: "purple" },
    { id: "cat_plan_survey", name: "Survey", tone: "amber" },
  ].map((c) => ({ ...c, group: "plan" }));
  await knex("document_categories").insert(planCategories).onConflict("id").ignore();

  // Backfill: create version 1 for existing documents that reference a file.
  const docs = await knex("project_documents")
    .whereNotNull("file_id")
    .select("id", "file_id", "file_name", "size", "size_bytes", "uploaded_at");
  for (const doc of docs) {
    const versionId = `dver_${doc.id}_1`;
    await knex("document_versions")
      .insert({
        id: versionId,
        document_id: doc.id,
        file_id: doc.file_id,
        version_no: 1,
        file_name: doc.file_name,
        size: doc.size,
        size_bytes: doc.size_bytes ?? null,
        created_at: doc.uploaded_at ?? knex.fn.now(),
      })
      .onConflict(["document_id", "version_no"])
      .ignore();
    await knex("project_documents").where({ id: doc.id }).update({ current_version_id: versionId });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_documents", (table) => {
    table.dropColumn("current_version_id");
  });
  await knex.schema.dropTableIfExists("document_versions");
  await knex("document_categories").where({ group: "plan" }).del();
  await knex.schema.alterTable("document_categories", (table) => {
    table.dropColumn("group");
  });
}
