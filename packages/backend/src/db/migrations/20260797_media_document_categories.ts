import type { Knex } from "knex";

const CATEGORIES = [
  { id: "cat_media_videos", name: "Site Videos", tone: "purple", group: "media" },
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
