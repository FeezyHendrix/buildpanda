import type { Knex } from "knex";

// Decision-bearing tables that the decision-chasing sweep escalates on.
const TABLES = ["approvals", "project_selections", "queries"] as const;

/**
 * Escalating decision reminders: track the highest reminder level already sent
 * (1 heads-up, 2 due, 3 escalated) so each level fires at most once per item,
 * plus when it was last sent. Cleared when an item is reopened.
 */
export async function up(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    await knex.schema.alterTable(table, (t) => {
      t.smallint("reminder_level");
      t.timestamp("last_reminded_at", { useTz: true });
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    await knex.schema.alterTable(table, (t) => {
      t.dropColumn("reminder_level");
      t.dropColumn("last_reminded_at");
    });
  }
}
