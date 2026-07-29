import type { Knex } from "knex";

// Attach the Sample Project on Railway prod (and any environment where it is
// still an orphan) to BuildPanda Admin's Company so admins see it in
// /me/projects and get a company-level /access response instead of the sparse
// client sidebar. Guarded on the target org existing plus the row still being
// unattached, so staging (already claimed by the local dev's org via the seed)
// and any other environment without the admin org are no-ops.

const PROJECT_ID = "sample-project";
const ADMIN_ORG_ID = "org_cb79a447-e1a8-4a9e-8e62-2effe64502d9";

export async function up(knex: Knex): Promise<void> {
  const org = await knex("organization").where({ id: ADMIN_ORG_ID }).first<{ id: string }>();
  if (!org) return;
  await knex("projects")
    .where({ id: PROJECT_ID })
    .whereNull("organization_id")
    .whereNull("owner_id")
    .update({ organization_id: ADMIN_ORG_ID });
}

export async function down(knex: Knex): Promise<void> {
  await knex("projects")
    .where({ id: PROJECT_ID, organization_id: ADMIN_ORG_ID })
    .update({ organization_id: null });
}
