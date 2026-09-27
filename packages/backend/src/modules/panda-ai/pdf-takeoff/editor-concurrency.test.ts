// The session lock, proved against real Postgres rather than asserted.
//
// Contract 19 requires every writer that touches an editor invariant to serialize
// on the session. The interesting case is not two editor operations — those always
// shared a lock — but an editor operation racing a LEGACY writer: the row PATCH,
// the bill line create, the assistant. Those ran on the pool, so their statements
// could interleave with an operation's and leave the winner's figure beside the
// loser's audit entry.
//
// These tests hold a real lock open on one connection and prove the other path
// waits for it, then prove the two orderings both produce a consistent bill.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import {
  connectTestDatabase,
  dropEditorFixture,
  m,
  seedEditorFixture,
  type EditorFixture,
} from "./editor-db-fixture.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import { lockedPreconService } from "./locked-service.ts";

let db: Knex;
let fixture: EditorFixture;

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "editor-concurrency");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};

function apply(command: EditorCommand): Promise<OperationReceipt> {
  return editorOperationService(db, noop).apply(
    fixture.sessionId,
    { operationId: `op_${randomUUID()}`, command },
    fixture.actor,
    GRANTS,
  );
}

async function slab(label: string): Promise<OperationReceipt> {
  return apply({
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool: "area",
    vertices: [
      [m(0), m(0)],
      [m(6), m(0)],
      [m(6), m(4)],
      [m(0), m(4)],
    ],
    description: `${label} ${randomUUID().slice(0, 6)}`,
    elementGroup: "Slabs",
    rate: 100,
  });
}

describe("a legacy writer waits for the session lock", () => {
  test("the row PATCH does not start while an operation holds the session", async () => {
    const created = await slab("Contended slab");
    const rowId = created.rows[0]!.id;
    const originalDescription = (await db("precon_boq_rows").where({ id: rowId }).first())?.["description"] as string;
    const locked = lockedPreconService(db, noop);

    // A real FOR UPDATE on the session row, held open on its own connection.
    const holder = await db.transaction();
    await holder.raw("SELECT id FROM precon_sessions WHERE id = ? FOR UPDATE", [fixture.sessionId]);

    let settled = false;
    const patch = locked
      .forRow(rowId, (api) => api.updateRow(rowId, { version: 1, changes: { description: "Renamed under lock" } }, fixture.actor))
      .then((row) => {
        settled = true;
        return row;
      });

    // Long enough that an unlocked write would certainly have landed.
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(settled, false, "the legacy writer is waiting, not racing the operation");
    assert.equal(
      (await db("precon_boq_rows").where({ id: rowId }).first())?.["description"],
      originalDescription,
      "and has written nothing yet",
    );

    await holder.rollback();
    const row = await patch;
    assert.equal(settled, true, "it proceeds once the lock is released");
    assert.equal(row.description, "Renamed under lock", "and then applies exactly once");
    assert.equal(
      (await db("precon_boq_rows").where({ id: rowId }).first())?.["description"],
      "Renamed under lock",
      "committed",
    );
  });

  test("an editor operation and a legacy line create serialize into one consistent bill", async () => {
    const locked = lockedPreconService(db, noop);
    const before = Number(
      (await db("precon_boq_rows").where({ bill_id: fixture.billId }).whereNull("deleted_at").count("* as n").first())?.["n"],
    );

    // Fired together on purpose: whichever takes the lock first, both land whole.
    const [operationResult, createdRow] = await Promise.all([
      slab("Raced operation"),
      locked.forBill(fixture.billId, (api) =>
        api.createRow(fixture.billId, { description: `Raced legacy line ${randomUUID().slice(0, 6)}`, unit: "m2", qty: 5, rate: 10 }, fixture.actor),
      ),
    ]);

    const after = Number(
      (await db("precon_boq_rows").where({ bill_id: fixture.billId }).whereNull("deleted_at").count("* as n").first())?.["n"],
    );
    assert.equal(after, before + 2, "both writers landed; neither was lost and neither doubled");

    const operationRow = await db("precon_boq_rows").where({ id: operationResult.rows[0]?.id }).first();
    assert.equal(Number(operationRow?.["qty"]), 24, "the operation's line is whole");
    assert.equal(
      Number((await db("precon_geometries").where({ row_id: operationResult.rows[0]?.id }).count("* as n").first())?.["n"]),
      1,
      "with its shape",
    );
    const legacyRow = await db("precon_boq_rows").where({ id: createdRow.id }).first();
    assert.equal(Number(legacyRow?.["qty"]), 5, "and the legacy line is whole too");
  });

  test("a rolled-back locked write leaves no row and no audit entry", async () => {
    const locked = lockedPreconService(db, noop);
    const before = Number(
      (await db("precon_boq_rows").where({ bill_id: fixture.billId }).whereNull("deleted_at").count("* as n").first())?.["n"],
    );
    const auditBefore = Number(
      (await db("precon_audit_events").where({ session_id: fixture.sessionId }).count("* as n").first())?.["n"],
    );

    await assert.rejects(
      locked.forBill(fixture.billId, async (api) => {
        await api.createRow(fixture.billId, { description: "Doomed line", unit: "m2", qty: 1, rate: 1 }, fixture.actor);
        throw new Error("injected failure after the legacy writer wrote");
      }),
      /injected failure/,
    );

    assert.equal(
      Number((await db("precon_boq_rows").where({ bill_id: fixture.billId }).whereNull("deleted_at").count("* as n").first())?.["n"]),
      before,
      "the line did not survive",
    );
    assert.equal(
      Number((await db("precon_audit_events").where({ session_id: fixture.sessionId }).count("* as n").first())?.["n"]),
      auditBefore,
      "and neither did its audit entry: the legacy writer is now transactional",
    );
  });
});
