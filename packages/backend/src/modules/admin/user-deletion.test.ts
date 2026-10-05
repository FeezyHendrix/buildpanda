import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import knexFactory, { type Knex } from "knex";
import { down, up } from "../../db/migrations/20261005_user_deletion_access_cleanup.ts";
import { adminRepository } from "./repository.ts";

// Use a disposable, migrated database; every case rolls back its own fixture.
const connection = process.env["USER_DELETION_TEST_DATABASE_URL"];
const options = { skip: connection ? false : "requires USER_DELETION_TEST_DATABASE_URL" };
let db: Knex;

before(() => {
  if (connection) db = knexFactory({ client: "pg", connection, pool: { min: 0, max: 2 } });
});
after(async () => { if (db) await db.destroy(); });

async function seed(trx: Knex.Transaction) {
  const tag = randomUUID();
  const deletedId = `usr_deleted_${tag}`;
  const ownerId = `usr_owner_${tag}`;
  const orgId = `org_${tag}`;
  const projectId = `prj_${tag}`;
  const email = `deleted-${tag}@example.test`;
  const oldDate = new Date("2020-01-01T00:00:00Z");
  await trx("user").insert([
    { id: deletedId, name: "Deleted account", email },
    { id: ownerId, name: "Project owner", email: `owner-${tag}@example.test` },
  ]);
  await trx("organization").insert({ id: orgId, name: "Deletion test", slug: tag });
  await trx("projects").insert({
    id: projectId, organization_id: orgId, owner_id: ownerId,
    name: "Project history", address: "1 Test Street", status: "On Track", risk: "Low", currency: "NGN",
  });
  const participant = (suffix: string, userId: string | null, address: string, status: string) => ({
    id: `pp_${suffix}_${tag}`, project_id: projectId, user_id: userId, email: address,
    role: "client", status, name: `History ${suffix}`, invited_by_id: ownerId,
    invite_token: `pinv_${suffix}_${tag}`, invite_expires_at: new Date("2099-01-01T00:00:00Z"),
    created_at: oldDate, updated_at: oldDate,
  });
  const participants = [
    // A linked account can have changed its email since it accepted the invite.
    participant("linked", deletedId, `old-${email}`, "active"),
    participant("invited", null, email.toUpperCase(), "invited"),
    participant("orphan", null, email, "active"),
    participant("revoked", null, email, "revoked"),
    participant("unrelated", null, `other-${email}`, "invited"),
    // An email match must never revoke a row linked to another living user.
    participant("other-linked", ownerId, email, "active"),
  ];
  await trx("project_participants").insert(participants);
  const invitation = (suffix: string, status: string, address = email) => ({
    id: `inv_${suffix}_${tag}`, organizationId: orgId, inviterId: ownerId,
    email: address, role: "member", status, createdAt: oldDate,
    expiresAt: suffix === "expired" ? oldDate : new Date("2099-01-01T00:00:00Z"),
  });
  const invitations = [
    invitation("pending", "pending", email.toUpperCase()),
    invitation("expired", "pending"),
    invitation("accepted", "accepted"),
    invitation("rejected", "rejected"),
    invitation("canceled", "canceled"),
    invitation("unrelated", "pending", `other-${email}`),
  ];
  await trx("invitation").insert(invitations);
  await trx("member").insert({ id: `mem_${tag}`, organizationId: orgId, userId: deletedId, role: "member" });
  await trx("session").insert({
    id: `ses_${tag}`, userId: deletedId, token: tag, expiresAt: new Date("2099-01-01T00:00:00Z"),
  });
  await trx("account").insert({ id: `acc_${tag}`, userId: deletedId, accountId: deletedId, providerId: "credential" });
  // A surviving record referencing a participant must not be deleted by cleanup.
  await trx.raw('CREATE TABLE deletion_history_test (participant_id text REFERENCES project_participants(id))');
  await trx("deletion_history_test").insert({ participant_id: participants[0]!.id });
  return { deletedId, ownerId, orgId, projectId, email, participants, invitations };
}

async function withFixture(run: (trx: Knex.Transaction, fixture: Awaited<ReturnType<typeof seed>>) => Promise<void>) {
  const trx = await db.transaction();
  try { await run(trx, await seed(trx)); }
  finally { await trx.rollback(); }
}

test("Watchtower deletion revokes access and preserves participant history", options, async () => {
  await withFixture(async (trx, fixture) => {
    const before = await trx("project_participants").where({ project_id: fixture.projectId }).orderBy("id");
    await adminRepository(trx).deleteUser(fixture.deletedId);
    const after = await trx("project_participants").where({ project_id: fixture.projectId }).orderBy("id");
    assert.equal(after.length, before.length);
    for (const previous of before) {
      const current = after.find((row) => row.id === previous.id)!;
      const affected = fixture.participants.slice(0, 3).some((row) => row.id === previous.id);
      if (!affected) { assert.deepEqual(current, previous); continue; }
      assert.equal(current.status, "revoked");
      assert.equal(current.user_id, null);
      assert.equal(current.invite_token, null);
      assert.equal(current.invite_expires_at, null);
      assert.ok(current.updated_at > previous.updated_at);
      assert.deepEqual({ ...current, status: previous.status, user_id: previous.user_id,
        invite_token: previous.invite_token, invite_expires_at: previous.invite_expires_at,
        updated_at: previous.updated_at }, previous);
    }
    assert.equal((await trx("deletion_history_test")).length, 1);
    assert.ok(await trx("projects").where({ id: fixture.projectId }).first());
    for (const table of ["session", "account", "member"]) {
      assert.equal((await trx(table).where({ userId: fixture.deletedId })).length, 0);
    }
    assert.equal(await trx("user").where({ id: fixture.deletedId }).first(), undefined);
  });
});

test("deletion cancels pending invitations, including expired and differently cased emails", options, async () => {
  await withFixture(async (trx, fixture) => {
    const before = await trx("invitation").where({ organizationId: fixture.orgId }).orderBy("id");
    await adminRepository(trx).deleteUser(fixture.deletedId);
    const after = await trx("invitation").where({ organizationId: fixture.orgId }).orderBy("id");
    assert.deepEqual(after, before.map((row) => ({
      ...row, status: row.status === "pending" && row.email.toLowerCase() === fixture.email ? "canceled" : row.status,
    })));
  });
});

test("direct authentication deletions clean up access and a replacement account cannot use old links", options, async () => {
  await withFixture(async (trx, fixture) => {
    await trx("user").where({ id: fixture.deletedId }).delete();
    await trx("user").insert({ id: `replacement_${randomUUID()}`, name: "Replacement", email: fixture.email });
    const oldTokens = fixture.participants.slice(0, 3).map((row) => row.invite_token);
    assert.equal((await trx("project_participants").whereIn("invite_token", oldTokens)).length, 0);
    assert.equal((await trx("project_participants").whereIn("id", fixture.participants.slice(0, 3).map((row) => row.id))
      .whereNot("status", "revoked")).length, 0);
    assert.equal((await trx("invitation").whereRaw("lower(email) = ?", [fixture.email]).where({ status: "pending" })).length, 0);
  });
});

test("a failed account deletion rolls back all access cleanup", options, async () => {
  await withFixture(async (trx, fixture) => {
    const participants = await trx("project_participants").where({ project_id: fixture.projectId }).orderBy("id");
    const invitations = await trx("invitation").where({ organizationId: fixture.orgId }).orderBy("id");
    await trx.raw('CREATE TABLE deletion_blocker_test (user_id text REFERENCES "user"(id) ON DELETE RESTRICT)');
    await trx("deletion_blocker_test").insert({ user_id: fixture.deletedId });
    await assert.rejects(trx.transaction(async (nested) => {
      await adminRepository(nested).deleteUser(fixture.deletedId);
    }), (error: { code?: string }) => error.code === "23503");
    assert.ok(await trx("user").where({ id: fixture.deletedId }).first());
    assert.deepEqual(await trx("project_participants").where({ project_id: fixture.projectId }).orderBy("id"), participants);
    assert.deepEqual(await trx("invitation").where({ organizationId: fixture.orgId }).orderBy("id"), invitations);
  });
});

test("deleting a nonexistent account leaves unrelated access unchanged", options, async () => {
  await withFixture(async (trx, fixture) => {
    const participants = await trx("project_participants").where({ project_id: fixture.projectId }).orderBy("id");
    const invitations = await trx("invitation").where({ organizationId: fixture.orgId }).orderBy("id");
    await adminRepository(trx).deleteUser(`missing_${randomUUID()}`);
    assert.deepEqual(await trx("project_participants").where({ project_id: fixture.projectId }).orderBy("id"), participants);
    assert.deepEqual(await trx("invitation").where({ organizationId: fixture.orgId }).orderBy("id"), invitations);
  });
});

test("the migration can be rolled back and reapplied without modifying existing invitations", options, async () => {
  await withFixture(async (trx, fixture) => {
    const participants = await trx("project_participants").where({ project_id: fixture.projectId }).orderBy("id");
    const invitations = await trx("invitation").where({ organizationId: fixture.orgId }).orderBy("id");
    await down(trx);
    await up(trx);
    assert.deepEqual(await trx("project_participants").where({ project_id: fixture.projectId }).orderBy("id"), participants);
    assert.deepEqual(await trx("invitation").where({ organizationId: fixture.orgId }).orderBy("id"), invitations);
    await adminRepository(trx).deleteUser(fixture.deletedId);
    assert.equal((await trx("project_participants").where({ id: fixture.participants[0]!.id }).first()).status, "revoked");
  });
});
