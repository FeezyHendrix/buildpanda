import type { Knex } from "knex";

// The last plain-text fields a person actually composes. Everything else that
// is written rather than picked already has an _html sibling; these four
// modules were left behind.
const COLUMNS: ReadonlyArray<{ table: string; column: string }> = [
  { table: "rfis", column: "question_html" },
  { table: "rfis", column: "official_response_html" },
  { table: "queries", column: "question_html" },
  { table: "queries", column: "answer_html" },
  { table: "approvals", column: "response_html" },
  { table: "change_requests", column: "reason_html" },
];

export async function up(knex: Knex): Promise<void> {
  for (const { table, column } of COLUMNS) {
    await knex.schema.alterTable(table, (t) => {
      t.text(column);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const { table, column } of COLUMNS) {
    await knex.schema.alterTable(table, (t) => {
      t.dropColumn(column);
    });
  }
}
