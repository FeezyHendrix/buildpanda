import type { Knex } from "knex";

/**
 * A workspace and the people in it, so a freshly cloned database demonstrates
 * the product instead of a shell of it.
 *
 * Most of the seed suite hangs off an organisation and a real user: the sample
 * project attaches to the first organisation, and any table whose author or
 * owner column is a hard foreign key to `user` (uploaded files, task
 * assignees, notifications, team members, proposals and the whole
 * pre-construction set) silently skips its insert when no account exists. On a
 * database nobody has signed up to, that was most of the app.
 *
 * Two deliberate constraints:
 *
 * 1. These users carry NO `account` row, so they hold no credential and cannot
 *    sign in. They exist to own records and to put a name against a comment.
 *    Shipping a seeded login would be shipping a default password.
 * 2. The whole file no-ops the moment a real organisation exists, so it never
 *    competes with a developer's own workspace. `20260530_marbella.ts` picks
 *    the OLDEST organisation for the sample project, and quietly stealing that
 *    slot would move the project out of the workspace its owner works in.
 */

const ORG_ID = "org_demo_buildpanda";
const ORG_SLUG = "sample-construction";

/** Matches the display names the rest of the seed suite already writes as free text. */
const DEMO_USERS = [
  {
    id: "usr_demo_pm",
    name: "Chidi Nwosu",
    email: "pm@demo.buildpanda.test",
    accountType: "company",
    profession: "Project Manager",
    role: "owner",
  },
  {
    id: "usr_demo_engineer",
    name: "Engr. David Okonjo",
    email: "engineer@demo.buildpanda.test",
    accountType: "company",
    profession: "Structural Engineer",
    role: "admin",
  },
  {
    id: "usr_demo_qs",
    name: "Amaka Eze",
    email: "qs@demo.buildpanda.test",
    accountType: "company",
    profession: "Quantity Surveyor",
    role: "member",
  },
  {
    id: "usr_demo_client",
    name: "Mr. Adeyi",
    email: "client@demo.buildpanda.test",
    accountType: "individual",
    profession: "Homeowner",
    role: "member",
  },
] as const;

/** The `.test` TLD is reserved by RFC 6761, so these addresses can never route to a real inbox. */
const DEMO_EMAIL_SUFFIX = "@demo.buildpanda.test";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function seed(knex: Knex): Promise<void> {
  const hasOrg = await knex.schema.hasTable("organization");
  const hasUser = await knex.schema.hasTable("user");
  const hasMember = await knex.schema.hasTable("member");
  if (!hasOrg || !hasUser || !hasMember) return;

  // A real workspace wins. The synthetic rows behind the admin dashboard's
  // charts are not one, so they are excluded from the test.
  const realOrg = await knex("organization")
    .whereNot("id", ORG_ID)
    .where("id", "not like", "demo_metrics_%")
    .first<{ id: string }>("id");
  if (realOrg) return;

  // Re-runnable: members reference both sides, so they go first.
  await knex("member").where({ organizationId: ORG_ID }).del();
  await knex("user").where("email", "like", `%${DEMO_EMAIL_SUFFIX}`).del();
  await knex("organization").where({ id: ORG_ID }).del();

  const hasAccountType = await knex.schema.hasColumn("user", "accountType");
  const hasAdminRole = await knex.schema.hasColumn("user", "role");
  const hasCompanyName = await knex.schema.hasColumn("user", "companyName");

  await knex("organization").insert({
    id: ORG_ID,
    name: "Sample Construction Ltd",
    slug: ORG_SLUG,
    logo: null,
    metadata: null,
    createdAt: isoDaysAgo(270),
    updatedAt: isoDaysAgo(1),
  });

  await knex("user").insert(
    DEMO_USERS.map((person, index) => ({
      id: person.id,
      name: person.name,
      email: person.email,
      emailVerified: true,
      image: null,
      country: "NG",
      phone: null,
      createdAt: isoDaysAgo(270 - index),
      updatedAt: isoDaysAgo(1),
      ...(hasAccountType ? { accountType: person.accountType, profession: person.profession } : {}),
      // The better-auth admin plugin's own role column, not the org role below.
      ...(hasAdminRole ? { role: "user" } : {}),
      ...(hasCompanyName ? { companyName: "Sample Construction Ltd" } : {}),
    })),
  );

  await knex("member").insert(
    DEMO_USERS.map((person, index) => ({
      id: `mem_demo_${person.id}`,
      organizationId: ORG_ID,
      userId: person.id,
      role: person.role,
      createdAt: isoDaysAgo(270 - index),
    })),
  );
}
