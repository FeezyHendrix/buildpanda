import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import knexFactory, { type Knex } from "knex";
import { BadRequestError, ConflictError, PayloadTooLargeError } from "../../../lib/errors.ts";
import { OPERATION_LIMITS, assertOperationLimits, editorRepository } from "./editor-repository.ts";
import { createEditorUnitOfWork } from "./editor-unit-of-work.ts";
import type { PreconAuditEventRow } from "./row-types.ts";

// The editor's unit of work and its transaction-scoped repository: the session
// lock, the version check and the idempotency lookup that decide whether a save
// is allowed to land. These are claims about Postgres behaviour — NOWAIT, row
// locks, a partial unique index — so they are only honest against a real
// database, and are skipped rather than faked when none is configured.
//
// Point TAKEOFF_TEST_DATABASE_URL at a throwaway migrated database to run them.
// It must not be a shared one: the fixtures create and delete an organisation.

const TEST_DATABASE_URL = process.env["TAKEOFF_TEST_DATABASE_URL"] ?? "";
const NEEDS_DB = TEST_DATABASE_URL
  ? undefined
  : "requires isolated DB — set TAKEOFF_TEST_DATABASE_URL to a throwaway migrated database";

interface Fixture {
  orgId: string;
  projectId: string;
  sessionId: string;
  billId: string;
  rowId: string;
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
  const ids = {
    orgId: `org_${tag}`,
    projectId: `prj_${tag}`,
    sessionId: `pcs_${tag}`,
    billId: `pbl_${tag}`,
    rowId: `pbr_${tag}`,
  };
  await connection("organization").insert({ id: ids.orgId, name: `Editor UoW ${tag}`, slug: `editor-uow-${tag}` });
  await connection("projects").insert({
    id: ids.projectId,
    organization_id: ids.orgId,
    name: `Editor UoW ${tag}`,
    address: "1 Test Street",
    status: "On Track",
    risk: "Low",
    currency: "NGN",
  });
  await connection("precon_sessions").insert({
    id: ids.sessionId,
    project_id: ids.projectId,
    org_id: ids.orgId,
    title: `Editor UoW ${tag}`,
    status: "reviewing",
  });
  await connection("precon_bills").insert({ id: ids.billId, session_id: ids.sessionId, title: "Bill No. 1", sort: 0 });
  await connection("precon_boq_rows").insert({
    id: ids.rowId,
    bill_id: ids.billId,
    sort: 0,
    row_type: "item",
    description: "Blockwork to external walls",
    version: 1,
  });
  return ids;
}

before(async () => {
  if (!TEST_DATABASE_URL) return;
  // two connections: one test holds a lock open while another tries to take it
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

test("withSessionWrite: callback result is returned after commit", { skip: NEEDS_DB }, async () => {
  const connection = database();
  const { sessionId, rowId } = seeded();
  const published: { sessionId: string; version: number }[] = [];
  const withSessionWrite = createEditorUnitOfWork(connection, (id, event) => {
    published.push({ sessionId: id, version: event.version });
  });

  const result = await withSessionWrite(sessionId, async (ctx) => {
    const row = await ctx.rows.rowById(rowId);
    assert.ok(row, "the bound repository reads through the transaction");
    // an event queued mid-operation must not reach anyone until commit
    ctx.emit({
      type: "row.updated",
      sessionId,
      rowId,
      version: row.version,
      actor: "editor-uow-test",
      changes: { description: row.description },
    });
    assert.equal(published.length, 0, "nothing is published while the transaction is still open");
    return row.id;
  });

  assert.equal(result, rowId, "the callback's value is the caller's value");
  assert.deepEqual(published, [{ sessionId, version: 1 }], "the queued event is flushed once, after commit");
});

test("withSessionWrite: a rolled-back operation publishes nothing", { skip: NEEDS_DB }, async () => {
  const connection = database();
  const { sessionId, rowId } = seeded();
  const published: string[] = [];
  const withSessionWrite = createEditorUnitOfWork(connection, (id) => {
    published.push(id);
  });

  await assert.rejects(
    withSessionWrite(sessionId, async (ctx) => {
      ctx.emit({
        type: "row.deleted",
        sessionId,
        rowId,
        version: 1,
        actor: "editor-uow-test",
        changes: {},
      });
      throw new BadRequestError("the operation was refused halfway through");
    }),
    /refused halfway/,
  );
  assert.deepEqual(published, [], "an edit that never committed was never announced");
});

test("withSessionWrite: NOWAIT lock fails when session is locked by another tx", { skip: NEEDS_DB }, async () => {
  const connection = database();
  const { sessionId } = seeded();
  const withSessionWrite = createEditorUnitOfWork(connection);

  const blocker = await connection.transaction();
  await blocker.raw("SELECT id FROM precon_sessions WHERE id = ? FOR UPDATE", [sessionId]);
  try {
    await assert.rejects(
      withSessionWrite(sessionId, async () => "must not run"),
      (error: unknown) => {
        assert.ok(error instanceof ConflictError, "a contended save is a 409, not a hang and not a 500");
        assert.match(error.message, /another operation/i);
        return true;
      },
    );
  } finally {
    await blocker.rollback();
  }

  const afterRelease = await withSessionWrite(sessionId, async () => "ran");
  assert.equal(afterRelease, "ran", "the lock is released with the transaction that took it");
});

test("withSessionWrite: an unknown session is a 404, not a silent no-op", { skip: NEEDS_DB }, async () => {
  const withSessionWrite = createEditorUnitOfWork(database());
  await assert.rejects(
    withSessionWrite(`pcs_${randomUUID().slice(0, 8)}`, async () => "must not run"),
    /Preconstruction session not found/,
  );
});

test("editorRepository.lockRow: version mismatch throws ConflictError", { skip: NEEDS_DB }, async () => {
  const connection = database();
  const { rowId } = seeded();
  const trx = await connection.transaction();
  try {
    const repo = editorRepository(trx);
    const held = await repo.lockRow(rowId, 1);
    assert.equal(held.id, rowId, "the matching version locks and returns the row");

    await assert.rejects(repo.lockRow(rowId, 7), (error: unknown) => {
      assert.ok(error instanceof ConflictError);
      assert.match(error.message, /current version 1/, "the client is told what to reload to");
      return true;
    });
  } finally {
    await trx.rollback();
  }
});

test("editorRepository.findCommittedOperation: returns existing event", { skip: NEEDS_DB }, async () => {
  const connection = database();
  const { sessionId, rowId } = seeded();
  const operationId = `op_${randomUUID().slice(0, 8)}`;
  const trx = await connection.transaction();
  try {
    const repo = editorRepository(trx);
    assert.equal(
      await repo.findCommittedOperation(sessionId, "editor-uow-test", operationId),
      null,
      "a first attempt has no receipt to replay",
    );

    const event: Omit<PreconAuditEventRow, "created_at"> = {
      id: `pae_${randomUUID().slice(0, 8)}`,
      session_id: sessionId,
      row_id: rowId,
      actor: "editor-uow-test",
      action: "adjusted",
      before: { qty: 10 },
      after: { qty: 12, requestFingerprint: "fp-1", receipt: { rowIds: [rowId] } },
      operation_id: operationId,
      reverses_event_id: null,
    };
    await repo.insertOperationAudit(event);

    const replayed = await repo.findCommittedOperation(sessionId, "editor-uow-test", operationId);
    assert.ok(replayed, "the retry finds the committed operation instead of editing twice");
    assert.deepEqual(replayed.after, event.after, "the receipt is what the retry replays");
    assert.equal(
      await repo.findCommittedOperation(sessionId, "someone-else", operationId),
      null,
      "an operation id is only idempotent for the actor who used it",
    );
  } finally {
    await trx.rollback();
  }
});

// Bounds are arithmetic on the request, not on the database, so this one runs
// everywhere: checkOperationLimits is assertOperationLimits behind the repo.
test("editorRepository.checkOperationLimits: throws over geometry limit", async () => {
  const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}_${i}`);
  const empty = { rowIds: [], geometryIds: [], sheetIds: [], markupIds: [] };

  assert.doesNotThrow(() =>
    assertOperationLimits({
      ...empty,
      geometryIds: ids("pg", OPERATION_LIMITS.geometries),
      rowIds: ids("pbr", OPERATION_LIMITS.rows),
      sheetIds: ids("psh", OPERATION_LIMITS.sheets),
      markupIds: ids("dmk", OPERATION_LIMITS.markups),
    }),
  );

  assert.throws(
    () => assertOperationLimits({ ...empty, geometryIds: ids("pg", OPERATION_LIMITS.geometries + 1) }),
    (error: unknown) => {
      // 413, not 400: nothing about the request is malformed, so the client must
      // split the selection rather than fix a field (contract 9).
      assert.ok(error instanceof PayloadTooLargeError, "an oversized selection is a 413");
      assert.equal(error.statusCode, 413);
      assert.equal(error.message, "Operation exceeds limit: too many geometries (max 200)");
      return true;
    },
  );
  assert.throws(
    () => assertOperationLimits({ ...empty, rowIds: ids("pbr", OPERATION_LIMITS.rows + 1) }),
    /too many rows \(max 1000\)/,
  );
  assert.throws(
    () => assertOperationLimits({ ...empty, sheetIds: ids("psh", OPERATION_LIMITS.sheets + 1) }),
    /too many sheets \(max 50\)/,
  );
  assert.throws(
    () => assertOperationLimits({ ...empty, markupIds: ids("dmk", OPERATION_LIMITS.markups + 1) }),
    /too many markups \(max 50\)/,
  );
});

test("editorRepository.checkOperationLimits: the repository enforces the same bounds", { skip: NEEDS_DB }, async () => {
  const connection = database();
  const trx = await connection.transaction();
  try {
    const repo = editorRepository(trx);
    await repo.checkOperationLimits({ rowIds: ["pbr_1"], geometryIds: [], sheetIds: [], markupIds: [] });
    await assert.rejects(
      repo.checkOperationLimits({
        rowIds: [],
        geometryIds: Array.from({ length: OPERATION_LIMITS.geometries + 1 }, (_, i) => `pg_${i}`),
        sheetIds: [],
        markupIds: [],
      }),
      /too many geometries \(max 200\)/,
    );
  } finally {
    await trx.rollback();
  }
});
