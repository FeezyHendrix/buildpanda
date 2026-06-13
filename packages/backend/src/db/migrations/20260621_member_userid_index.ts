import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // The existing unique(organizationId, userId) constraint is org-leading and
  // cannot serve userId-only filter efficiently. Add a covering index so the
  // auth-context preHandler can resolve all org memberships for a user in O(log n).
  await knex.schema.alterTable("member", (table) => {
    table.index(["userId"], "member_userId_idx");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("member", (table) => {
    table.dropIndex(["userId"], "member_userId_idx");
  });
}
