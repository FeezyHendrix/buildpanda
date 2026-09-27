import type { Knex } from "knex";

/**
 * A permit is a contractual gate, not a date. A road closure permit always
 * carries conditions — hours, lane widths, signage — and the instrument itself
 * has to be attached, not typed into Notes. "Expired with a renewal lodged" is
 * a very different risk from "expired, nothing done", and a permit that takes
 * six weeks to renew needs more than the fixed 30-day warning (findings #7, #8, #9).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("permits", (table) => {
    table
      .text("document_id")
      .references("id")
      .inTable("project_documents")
      .onDelete("SET NULL");
    table.text("conditions");
    table.text("responsible_person");
    table.date("renewal_submitted_at");
    // How long this authority takes to renew, so the warning arrives in time.
    table.integer("lead_time_days");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("permits", (table) => {
    table.dropColumn("lead_time_days");
    table.dropColumn("renewal_submitted_at");
    table.dropColumn("responsible_person");
    table.dropColumn("conditions");
    table.dropColumn("document_id");
  });
}
