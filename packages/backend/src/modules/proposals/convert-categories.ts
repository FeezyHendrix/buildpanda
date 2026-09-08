import type { Knex } from "knex";
import { CONVERSION_DOCUMENT_CATEGORIES } from "./convert-mappers.ts";

/**
 * The category ids a conversion writes are created by migrations, but a seed
 * or a hand edit can replace them with rows of the same name under other ids
 * (name is unique too). Resolve each id by id, then by name, and create it
 * only when neither exists, so the documents always land in a real category.
 */
export async function resolveConversionCategories(trx: Knex.Transaction): Promise<Map<string, string>> {
  const wanted = [...CONVERSION_DOCUMENT_CATEGORIES];
  const rows = await trx("document_categories")
    .whereIn("id", wanted.map((c) => c.id))
    .orWhereIn("name", wanted.map((c) => c.name))
    .select<{ id: string; name: string }[]>("id", "name");
  const byId = new Map(rows.map((r) => [r.id, r.id]));
  const byName = new Map(rows.map((r) => [r.name.toLowerCase(), r.id]));
  const resolved = new Map<string, string>();
  for (const c of wanted) {
    const found = byId.get(c.id) ?? byName.get(c.name.toLowerCase());
    if (found) {
      resolved.set(c.id, found);
      continue;
    }
    await trx("document_categories").insert(c);
    resolved.set(c.id, c.id);
  }
  return resolved;
}
