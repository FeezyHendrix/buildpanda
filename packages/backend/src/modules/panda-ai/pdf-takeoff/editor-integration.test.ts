import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import knexFactory, { type Knex } from "knex";
import { agentRepository } from "../agent/repository.ts";
import { preconRepository } from "./repository.ts";
import { rowService } from "./row-service.ts";
import type { PreconBoqRowRow } from "./row-types.ts";

// Withdrawing a bill line is a soft delete, so the claim survives a dispute.
// The claim worth proving is therefore about *readers*: every surface a QS or
// Panda AI reads a bill through must stop showing the line the moment it is
// withdrawn, and show it again when the withdrawal is undone. A filter missed
// on one reader is a line that reappears in a total nobody can explain, which
// is exactly the bug a soft delete introduces if it is only half applied.
//
// These are claims about SQL, so they only mean anything against Postgres:
// point TAKEOFF_TEST_DATABASE_URL at a throwaway migrated database to run them.
// It must not be a shared one — the fixture creates and deletes an organisation.

const TEST_DATABASE_URL = process.env["TAKEOFF_TEST_DATABASE_URL"] ?? "";
const NEEDS_DB = TEST_DATABASE_URL
  ? undefined
  : "requires isolated DB — set TAKEOFF_TEST_DATABASE_URL to a throwaway migrated database";

const ACTOR = "editor-integration-test";

interface Fixture {
  orgId: string;
  projectId: string;
  sessionId: string;
  billId: string;
  sheetId: string;
  rowId: string;
  geometryId: string;
}

let db: Knex | null = null;
let fixture: Fixture | null = null;

function database(): Knex {
  assert.ok(db, "the database fixture is only available when TAKEOFF_TEST_DATABASE_URL is set");
  return db;
}

function seeded(): Fixture {
  assert.ok(fixture, "the seeded fixture is only available when TAKEOFF_TEST_DATABASE_URL is set");
  return fixture;
}

async function seed(connection: Knex): Promise<Fixture> {
  const tag = randomUUID().slice(0, 8);
  const ids: Fixture = {
    orgId: `org_${tag}`,
    projectId: `prj_${tag}`,
    sessionId: `pcs_${tag}`,
    billId: `pbl_${tag}`,
    sheetId: `psh_${tag}`,
    rowId: `pbr_${tag}`,
    geometryId: `pgm_${tag}`,
  };
  await connection("organization").insert({ id: ids.orgId, name: `Editor E2E ${tag}`, slug: `editor-e2e-${tag}` });
  await connection("projects").insert({
    id: ids.projectId,
    organization_id: ids.orgId,
    name: `Editor E2E ${tag}`,
    address: "1 Test Street",
    status: "On Track",
    risk: "Low",
    currency: "NGN",
  });
  await connection("precon_sessions").insert({
    id: ids.sessionId,
    project_id: ids.projectId,
    org_id: ids.orgId,
    title: `Editor E2E ${tag}`,
    status: "reviewing",
  });
  await connection("precon_bills").insert({ id: ids.billId, session_id: ids.sessionId, title: "Bill No. 1", sort: 0 });
  await connection("precon_sheets").insert({
    id: ids.sheetId,
    session_id: ids.sessionId,
    file_name: "plan.pdf",
    storage_path: `precon/${tag}/plan.pdf`,
    page_number: 1,
  });
  await connection("precon_boq_rows").insert({
    id: ids.rowId,
    bill_id: ids.billId,
    sort: 0,
    row_type: "item",
    description: "Blockwork to external walls",
    unit: "m2",
    qty: 42,
    rate: 100,
    amount: 4200,
    status: "verified",
    version: 1,
  });
  await connection("precon_geometries").insert({
    id: ids.geometryId,
    row_id: ids.rowId,
    sheet_id: ids.sheetId,
    kind: "area",
    vertices: JSON.stringify([
      [0, 0],
      [10, 0],
      [10, 10],
    ]),
    source: "manual",
  });
  return ids;
}

function rowsFor(connection: Knex) {
  const repo = preconRepository(connection);
  return rowService({
    repo,
    audit: async () => {},
    publish: () => {},
    requireRow: async (rowId: string) => {
      const row = await repo.rowById(rowId);
      const sessionId = await repo.sessionIdForRow(rowId);
      assert.ok(row && sessionId, "the fixture row is readable before it is withdrawn");
      return { row: row as PreconBoqRowRow, sessionId };
    },
    isAnchorRow: () => false,
    recomputeDerivedRows: async () => {},
    assertDerivedFanoutWithinCap: async () => {},
  });
}

/** Each test owns the whole soft-delete lifecycle, so order cannot leak state. */
async function withRowWithdrawn(check: () => Promise<void>): Promise<void> {
  const connection = database();
  const { rowId } = seeded();
  const rows = rowsFor(connection);
  await rows.removeRow(rowId, ACTOR);
  try {
    await check();
  } finally {
    await rows.restoreRow(rowId, ACTOR);
  }
}

before(async () => {
  if (!TEST_DATABASE_URL) return;
  db = knexFactory({ client: "pg", connection: TEST_DATABASE_URL, pool: { min: 1, max: 4 } });
  fixture = await seed(db);
});

after(async () => {
  if (!db) return;
  if (fixture) {
    await db("precon_sessions").where({ id: fixture.sessionId }).delete();
    await db("projects").where({ id: fixture.projectId }).delete();
    await db("organization").where({ id: fixture.orgId }).delete();
  }
  await db.destroy();
  db = null;
});

test("rowsBySession excludes soft-deleted rows", { skip: NEEDS_DB }, async () => {
  const connection = database();
  const { sessionId, rowId } = seeded();
  const repo = preconRepository(connection);

  const onBill = await repo.rowsBySession(sessionId);
  assert.ok(
    onBill.some((r) => r.id === rowId),
    "the line is on the bill before it is withdrawn",
  );

  await withRowWithdrawn(async () => {
    const during = await repo.rowsBySession(sessionId);
    assert.equal(during.some((r) => r.id === rowId), false, "a withdrawn line is off the bill");
    const tombstone = await repo.rowByIdIncludeDeleted(rowId);
    assert.ok(tombstone?.deleted_at, "the line is tombstoned, not erased — the claim survives the dispute");
  });
});

test("rowById returns null for soft-deleted row", { skip: NEEDS_DB }, async () => {
  const connection = database();
  const { rowId } = seeded();
  const repo = preconRepository(connection);

  await withRowWithdrawn(async () => {
    assert.equal(await repo.rowById(rowId), undefined, "the active reader cannot see a withdrawn line");
  });
});

test("geometriesBySession excludes rows with soft-deleted parent", { skip: NEEDS_DB }, async () => {
  const connection = database();
  const { sessionId, rowId, geometryId } = seeded();
  const repo = preconRepository(connection);

  const onSheetBefore = await repo.geometriesBySession(sessionId);
  assert.ok(
    onSheetBefore.some((g) => g.id === geometryId),
    "the annotation is on the sheet before its line is withdrawn",
  );

  await withRowWithdrawn(async () => {
    const onSheet = await repo.geometriesBySession(sessionId);
    assert.equal(
      onSheet.some((g) => g.id === geometryId),
      false,
      "the sheet stops showing a measurement the bill no longer has",
    );
    assert.deepEqual(await repo.geometriesByRow(rowId), [], "and the line's own annotations go with it");
    assert.equal((await repo.geometriesByRowIncludeDeleted(rowId)).length, 1, "the annotation is kept for the undo");
  });
});

test("agentRepository.preconBoqRows excludes soft-deleted rows", { skip: NEEDS_DB }, async () => {
  const connection = database();
  const { projectId, sessionId } = seeded();
  const agent = agentRepository(connection);
  const repo = preconRepository(connection);

  assert.equal((await agent.preconBoqRows(projectId)).length, 1, "Panda AI can quote a line that is on the bill");

  await withRowWithdrawn(async () => {
    assert.deepEqual(
      await agent.preconBoqRows(projectId),
      [],
      "Panda AI must never quote a figure the QS has withdrawn",
    );
    const counts = await repo.lineCountsForSessions([sessionId]);
    assert.equal(counts.get(sessionId)?.total ?? 0, 0, "and the session's line count drops with it");
  });

  const restoredCounts = await repo.lineCountsForSessions([sessionId]);
  assert.equal(restoredCounts.get(sessionId)?.total, 1, "the line is counted again once the withdrawal is undone");
});

test("restoreRow makes the row visible again in rowsBySession", { skip: NEEDS_DB }, async () => {
  const connection = database();
  const { sessionId, rowId, geometryId } = seeded();
  const repo = preconRepository(connection);
  const rows = rowsFor(connection);

  await rows.removeRow(rowId, ACTOR);
  assert.equal((await repo.rowsBySession(sessionId)).some((r) => r.id === rowId), false);

  const restored = await rows.restoreRow(rowId, ACTOR);
  assert.equal(restored.id, rowId);
  assert.equal(restored.qty, 42, "the restored line carries the quantity that was claimed");
  assert.ok(
    (await repo.rowsBySession(sessionId)).some((r) => r.id === rowId),
    "the undone withdrawal puts the line back on the bill",
  );
  assert.ok(
    (await repo.geometriesBySession(sessionId)).some((g) => g.id === geometryId),
    "and puts its measurement back on the sheet",
  );
});
