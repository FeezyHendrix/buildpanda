import type { Knex } from "knex";

/**
 * A look-ahead approval is a sign-off, not a dropdown value. Before this,
 * "Approved" was just an option in the edit drawer that anyone who could edit
 * could set on their own plan, with no approver and no time (finding F29).
 * Recording who approved it and when is what makes the two-week plan a record
 * the site agent can hold up in a progress meeting.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("look_aheads", (table) => {
    table.text("approved_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("approved_by_name");
    table.timestamp("approved_at", { useTz: true });
    table.text("approval_note");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("look_aheads", (table) => {
    table.dropColumn("approval_note");
    table.dropColumn("approved_at");
    table.dropColumn("approved_by_name");
    table.dropColumn("approved_by_id");
  });
}
