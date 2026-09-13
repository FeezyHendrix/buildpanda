import type { Knex } from "knex";

/**
 * A document register needs an identity beyond a filename. "Upload Rev C as a
 * new version" was a filename convention, and there was nowhere to put a
 * traffic management plan, a method statement, an insurance certificate or a
 * BoQ — the categories were Land Documents and Proposal (findings #2, #3, F49).
 *
 * Categories are reference data in `document_categories`, so the construction
 * set is seeded rather than hard-coded; a company can still add its own.
 */
const CONSTRUCTION_CATEGORIES: { id: string; name: string; group: string }[] = [
  { id: "cat_doc_specifications", name: "Specifications", group: "document" },
  { id: "cat_doc_boq", name: "BoQ & commercial", group: "document" },
  { id: "cat_doc_method", name: "Method statements & plans", group: "document" },
  { id: "cat_doc_insurance", name: "Insurance & bonds", group: "document" },
  { id: "cat_doc_permits", name: "Permits & approvals", group: "document" },
  { id: "cat_doc_qa", name: "QA & test certificates", group: "document" },
  { id: "cat_doc_hs", name: "Health & safety", group: "document" },
  { id: "cat_doc_correspondence", name: "Correspondence", group: "document" },
  { id: "cat_doc_asbuilt", name: "As-builts", group: "document" },
];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_documents", (table) => {
    // The title a person reads; the filename stays as the file's own name.
    table.text("title");
    // "Rev C", "P02". Free text: every discipline numbers differently.
    table.text("revision");
    table.text("supersedes_id").references("id").inTable("project_documents").onDelete("SET NULL");
    // Who may see it. A contractor's internal method statement is not the
    // client's business; a drawing issued for construction is.
    table.text("visibility").notNullable().defaultTo("internal");
    table.date("document_date");
    table.index(["supersedes_id"]);
  });
  await knex.raw(
    "ALTER TABLE project_documents ADD CONSTRAINT project_documents_visibility_check CHECK (visibility IN ('internal', 'shared'))",
  );

  for (const category of CONSTRUCTION_CATEGORIES) {
    await knex("document_categories")
      .insert({ id: category.id, name: category.name, tone: "brand", group: category.group })
      .onConflict("id")
      .ignore();
  }
  // "Drawings" already exists as the plan-side set; only the document set is seeded here.
}

export async function down(knex: Knex): Promise<void> {
  await knex("project_documents")
    .whereIn(
      "category_id",
      CONSTRUCTION_CATEGORIES.map((c) => c.id),
    )
    .update({ category_id: null });
  await knex("document_categories")
    .whereIn(
      "id",
      CONSTRUCTION_CATEGORIES.map((c) => c.id),
    )
    .del();
  await knex.raw("ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS project_documents_visibility_check");
  await knex.schema.alterTable("project_documents", (table) => {
    table.dropIndex(["supersedes_id"]);
    table.dropColumn("document_date");
    table.dropColumn("visibility");
    table.dropColumn("supersedes_id");
    table.dropColumn("revision");
    table.dropColumn("title");
  });
}
