import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("organization", (t) => {
    t.string("country", 2).nullable();
    t.string("state", 120).nullable();
    t.string("company_size", 20).nullable();
    t.jsonb("usage").nullable();
    t.timestamp("onboarding_completed_at").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("organization", (t) => {
    t.dropColumn("onboarding_completed_at");
    t.dropColumn("usage");
    t.dropColumn("company_size");
    t.dropColumn("state");
    t.dropColumn("country");
  });
}
