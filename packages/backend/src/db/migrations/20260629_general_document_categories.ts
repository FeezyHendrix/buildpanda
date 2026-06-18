import type { Knex } from "knex";

const CATEGORIES = [
  { id: "cat_doc_contracts", name: "Contracts & Agreements", tone: "purple", group: "document" },
  { id: "cat_doc_permits", name: "Permits & Approvals", tone: "red", group: "document" },
  { id: "cat_doc_reports", name: "Reports", tone: "brand", group: "document" },
  { id: "cat_doc_method", name: "Method Statements", tone: "orange", group: "document" },
  { id: "cat_doc_safety", name: "Health & Safety", tone: "red", group: "document" },
  { id: "cat_doc_correspondence", name: "Correspondence", tone: "gray", group: "document" },
  { id: "cat_doc_specs", name: "Specifications", tone: "amber", group: "document" },
  { id: "cat_doc_schedules", name: "Schedules & Programmes", tone: "brand", group: "document" },
  { id: "cat_doc_financial", name: "Invoices & Financial", tone: "green", group: "document" },
  { id: "cat_doc_handover", name: "Handover & O&M", tone: "purple", group: "document" },
  { id: "cat_doc_photos", name: "Site Photos", tone: "green", group: "media" },
  { id: "cat_doc_other", name: "Other", tone: "gray", group: "document" },
] as const;

export async function up(knex: Knex): Promise<void> {
  const existing = await knex("document_categories").select<{ id: string; name: string }[]>("id", "name");
  const existingIds = new Set(existing.map((r) => r.id));
  const existingNames = new Set(existing.map((r) => r.name));
  const toInsert = CATEGORIES.filter((c) => !existingIds.has(c.id) && !existingNames.has(c.name));
  if (toInsert.length > 0) {
    await knex("document_categories").insert([...toInsert]);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex("document_categories")
    .whereIn(
      "id",
      CATEGORIES.map((c) => c.id),
    )
    .del();
}
