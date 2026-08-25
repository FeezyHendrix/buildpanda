import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    table.boolean("is_sample").notNullable().defaultTo(false);
  });

  // Provisioning is keyed off "does this workspace already have a sample?", so
  // the lookup runs on every sign-up and must not scan the table.
  await knex.schema.alterTable("projects", (table) => {
    table.index(["organization_id", "is_sample"], "projects_org_is_sample_index");
  });

  // The pre-existing singleton predates per-workspace provisioning; label it so
  // it is not double-counted as a real project in admin metrics.
  await knex("projects").where({ id: "sample-project" }).update({ is_sample: true });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    table.dropIndex(["organization_id", "is_sample"], "projects_org_is_sample_index");
    table.dropColumn("is_sample");
  });
}
