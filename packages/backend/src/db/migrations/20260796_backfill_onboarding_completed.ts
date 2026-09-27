import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Every organization that exists at this point predates the onboarding wizard,
  // so none of them could have completed it. The route guard reads a NULL here as
  // "send this workspace through the wizard" — and only owners/admins may submit
  // it — so leaving them NULL locks every existing non-owner member out of the
  // app entirely. Their creation date is the closest honest stand-in.
  await knex("organization")
    .whereNull("onboarding_completed_at")
    .update({ onboarding_completed_at: knex.ref("createdAt") });
}

export async function down(): Promise<void> {
  // Irreversible by design: a backfilled timestamp is indistinguishable from a
  // genuinely completed one, so re-nulling would discard real completions.
}
