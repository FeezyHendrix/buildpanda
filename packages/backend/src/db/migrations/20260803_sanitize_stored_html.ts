import type { Knex } from "knex";
import sanitizeHtml from "sanitize-html";

// Frozen copy of lib/rich-text.ts's allowlist as it stood when this ran. A data
// migration must keep doing what it did on the day it was applied, so it does
// not import the app's sanitiser — that one is free to change later.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "span", "strong", "b", "em", "i", "u", "s", "sub", "sup",
    "ul", "ol", "li", "blockquote", "code", "pre",
    "h1", "h2", "h3", "h4",
    "a",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    span: ["class"],
    code: ["class"],
    pre: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
  disallowedTagsMode: "discard",
};

const BATCH = 500;

/**
 * Rows written before sanitising moved to the request boundary still hold
 * whatever was submitted, and three of these columns are rendered with
 * dangerouslySetInnerHTML. Discovered from information_schema rather than
 * listed by hand so a column added since cannot be missed.
 */
async function sanitizeColumn(knex: Knex, table: string, column: string): Promise<number> {
  let cleaned = 0;
  let lastId: string | null = null;

  for (;;) {
    const rows = await knex(table)
      .whereNotNull(column)
      .modify((q) => {
        if (lastId !== null) q.where("id", ">", lastId);
      })
      .orderBy("id", "asc")
      .limit(BATCH)
      .select("id", `${column} as value`);

    if (rows.length === 0) break;

    for (const row of rows as { id: string; value: string }[]) {
      const safe = sanitizeHtml(row.value, OPTIONS);
      // Only touch rows that actually change, so updated_at style triggers and
      // replication churn stay proportional to the damage.
      if (safe !== row.value) {
        await knex(table).where({ id: row.id }).update({ [column]: safe });
        cleaned += 1;
      }
    }

    lastId = (rows[rows.length - 1] as { id: string }).id;
  }

  return cleaned;
}

export async function up(knex: Knex): Promise<void> {
  const columns = await knex("information_schema.columns")
    .where({ table_schema: "public" })
    .andWhere("column_name", "like", "%\\_html")
    .select<{ table_name: string; column_name: string }[]>("table_name", "column_name");

  let total = 0;
  for (const { table_name, column_name } of columns) {
    // Every table carrying rich text has a text id; skip anything that does not
    // rather than guessing at its key.
    const hasId = await knex("information_schema.columns")
      .where({ table_schema: "public", table_name, column_name: "id" })
      .first();
    if (!hasId) continue;

    total += await sanitizeColumn(knex, table_name, column_name);
  }

  console.log(`[sanitize_stored_html] rewrote ${total} row(s)`);
}

export async function down(): Promise<void> {
  // Irreversible on purpose: the original markup was the vulnerability, and
  // this migration does not keep a copy of it to restore.
}
