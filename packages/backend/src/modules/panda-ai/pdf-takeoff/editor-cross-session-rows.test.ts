// A line named by a caller must belong to the take-off the operation is in —
// including the lines that carry no shape at all.
//
// The envelope used to infer session membership from the drawings a line was
// measured on. For every line that has none, the loop was empty and the foreign
// id was accepted: an engine-drafted stated deduction, a derived line, a stated
// quantity, a line never measured, a line whose shapes were withdrawn. Those are
// not exotic — they are exactly what the stated-deduction commands exist to
// reach. A QS with `takeoffs:edit` in ANY organisation could restate another
// organisation's bill line and strip its sign-off.
//
// So these are real-database regressions. The claim is about `precon_bills`
// deciding membership, and about a refused operation leaving the victim's
// version, quantity, status, sign-off and audit trail exactly as they were. A
// double cannot make either claim, so this suite fails rather than skips when no
// database is configured.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { NotFoundError } from "../../../lib/errors.ts";
import { connectTestDatabase, dropEditorFixture, seedEditorFixture, type EditorFixture } from "./editor-db-fixture.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";

const ALL_GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};

/** The legacy opening the engine drafts: a figure with no shape to correct it by. */
const STATED_OPENING = { label: "Window W1", qty: 2, geometryId: null, unit: "m2", unitConfirmed: false };

let db: Knex;
/** The attacker's own take-off: real membership, real `takeoffs:edit`. */
let home: EditorFixture;
/** Another organisation entirely. */
let foreign: EditorFixture;
/** A second take-off inside the attacker's OWN organisation — the same-org, other-session case. */
let sibling: { sessionId: string; billId: string };

before(async () => {
  db = connectTestDatabase();
  home = await seedEditorFixture(db, "xsession-home");
  foreign = await seedEditorFixture(db, "xsession-foreign");
  const tag = randomUUID().slice(0, 8);
  sibling = { sessionId: `pcs_sib_${tag}`, billId: `pbl_sib_${tag}` };
  await db("precon_sessions").insert({
    id: sibling.sessionId,
    project_id: home.projectId,
    org_id: home.orgId,
    title: `Sibling take-off ${tag}`,
    status: "reviewing",
  });
  await db("precon_bills").insert({ id: sibling.billId, session_id: sibling.sessionId, title: "Bill No. 1", sort: 0 });
});

after(async () => {
  if (sibling) await db("precon_sessions").where({ id: sibling.sessionId }).delete();
  if (foreign) await dropEditorFixture(db, foreign);
  if (home) await dropEditorFixture(db, home);
  await db.destroy();
});

/**
 * A priced line with a quantity, a stated opening and NO geometry — the shape of
 * every row the old gate waved through. Inserted directly because the point is
 * the row's existence, not how it came to exist.
 */
async function geometrylessRow(billId: string): Promise<string> {
  const id = `pbr_${randomUUID().slice(0, 12)}`;
  await db("precon_boq_rows").insert({
    id,
    bill_id: billId,
    sort: 0,
    row_type: "item",
    element_group: "External walls",
    code: "F10/110",
    description: "Blockwork stated from schedule",
    unit: "m2",
    qty_gross: 100,
    qty: 98,
    deductions: JSON.stringify([STATED_OPENING]),
    typical: 1,
    rate: 5,
    amount: 490,
    rate_source: "library",
    confidence: "high",
    status: "verified",
    version: 1,
    measurement_basis: "100 m2 stated in the schedule less 2 m2 opening = 98 m2",
    origin: "ai",
  });
  return id;
}

interface RowState {
  version: number;
  qty: number | null;
  qty_gross: number | null;
  typical: number | null;
  status: string | null;
  amount: number | null;
  measurement_basis: string | null;
  deductions: unknown;
  edited_at: unknown;
  edited_by: unknown;
  verified_by: unknown;
  verified_at: unknown;
  updated_at: unknown;
}

/** Everything a cross-session write could move, as the table holds it. */
async function stateOf(rowId: string): Promise<RowState> {
  const row = await db("precon_boq_rows").where({ id: rowId }).first();
  assert.ok(row, "the line under test exists");
  return {
    version: Number(row["version"]),
    qty: row["qty"] === null ? null : Number(row["qty"]),
    qty_gross: row["qty_gross"] === null ? null : Number(row["qty_gross"]),
    typical: row["typical"] === null ? null : Number(row["typical"]),
    status: row["status"],
    amount: row["amount"] === null ? null : Number(row["amount"]),
    measurement_basis: row["measurement_basis"],
    deductions: row["deductions"],
    edited_at: row["edited_at"],
    edited_by: row["edited_by"],
    verified_by: row["verified_by"],
    verified_at: row["verified_at"],
    updated_at: row["updated_at"],
  };
}

async function auditCountForRow(rowId: string): Promise<number> {
  const row = await db("precon_audit_events").where({ row_id: rowId }).count("* as n").first();
  return Number(row?.["n"] ?? 0);
}

async function auditCountForSession(sessionId: string): Promise<number> {
  const row = await db("precon_audit_events").where({ session_id: sessionId }).count("* as n").first();
  return Number(row?.["n"] ?? 0);
}

/** The attacker's request: their OWN session in the URL, someone else's row id in the body. */
function applyFromHome(command: EditorCommand): Promise<OperationReceipt> {
  return editorOperationService(db, noop).apply(
    home.sessionId,
    { operationId: `op_${randomUUID()}`, expectedRows: [], command },
    home.actor,
    ALL_GRANTS,
  );
}

/**
 * The whole refusal contract in one place: a 404 that does not distinguish
 * "not here" from "not yours", and a victim left byte-for-byte as they were —
 * no version bump, no quantity, no status, no sign-off stripped, no audit entry
 * claiming the edit happened.
 */
async function refusedAndUntouched(
  command: EditorCommand,
  victimRowId: string,
  victimSessionId: string,
): Promise<void> {
  const before = await stateOf(victimRowId);
  const auditsBefore = await auditCountForRow(victimRowId);
  const sessionAuditsBefore = await auditCountForSession(victimSessionId);

  await assert.rejects(applyFromHome(command), (error: unknown) => {
    assert.ok(error instanceof NotFoundError, `a line outside the session must be a 404, got ${String(error)}`);
    return true;
  });

  assert.deepEqual(await stateOf(victimRowId), before, "the refused operation moved nothing on the victim's line");
  assert.equal(await auditCountForRow(victimRowId), auditsBefore, "and wrote no audit entry against it");
  assert.equal(
    await auditCountForSession(victimSessionId),
    sessionAuditsBefore,
    "and left the victim's take-off trail alone",
  );
}

describe("a line with no geometry is still scoped to its own take-off", () => {
  test("another organisation's line cannot be restated through set-row-typical", async () => {
    const victim = await geometrylessRow(foreign.billId);
    await refusedAndUntouched({ kind: "set-row-typical", rowId: victim, typical: 99 }, victim, foreign.sessionId);
  });

  test("a line in another take-off of the SAME organisation is refused too", async () => {
    const victim = await geometrylessRow(sibling.billId);
    await refusedAndUntouched({ kind: "set-row-typical", rowId: victim, typical: 99 }, victim, sibling.sessionId);
  });

  test("the caller's own geometry-less line still edits — the gate scopes, it does not block", async () => {
    const own = await geometrylessRow(home.billId);
    const before = await stateOf(own);

    const receipt = await applyFromHome({ kind: "set-row-typical", rowId: own, typical: 3 });

    assert.equal(receipt.replayed, false);
    const updated = await stateOf(own);
    assert.equal(updated.version, before.version + 1, "the line the caller owns moved on exactly once");
    assert.equal(updated.typical, 3, "and carries the multiplier they asked for");
    assert.equal(updated.qty, 294, "100 m2 less a 2 m2 opening, over 3 typical floors");

    const trail = await db("precon_audit_events").where({ row_id: own }).select("action", "operation_id");
    assert.equal(
      trail.filter((entry) => entry["operation_id"] === receipt.operationId).length,
      1,
      "one operation, one receipt-bearing audit event",
    );
    assert.ok(
      trail.some((entry) => entry["action"] === "typical_changed"),
      "and the act itself is on the record",
    );
  });

  test("the refusal does not depend on the line being priced or reachable another way", async () => {
    const victim = await geometrylessRow(foreign.billId);
    await refusedAndUntouched(
      { kind: "set-measurement-settings", rowId: victim, repeatLabels: ["Bay A", "Bay B"] },
      victim,
      foreign.sessionId,
    );
  });
});

describe("the stated-deduction commands reach geometry-less lines by design", () => {
  test("correcting another organisation's stated opening is a 404, not a write", async () => {
    const victim = await geometrylessRow(foreign.billId);
    await refusedAndUntouched(
      {
        kind: "edit-stated-deduction",
        rowId: victim,
        rowVersion: 1,
        index: 0,
        expect: { label: STATED_OPENING.label, qty: STATED_OPENING.qty, unit: STATED_OPENING.unit },
        qty: 40,
        unit: "m2",
        unitConfirmed: true,
      },
      victim,
      foreign.sessionId,
    );
  });

  test("removing another organisation's stated opening is refused with the figure intact", async () => {
    const victim = await geometrylessRow(foreign.billId);
    await refusedAndUntouched(
      {
        kind: "remove-stated-deduction",
        rowId: victim,
        rowVersion: 1,
        index: 0,
        expect: { label: STATED_OPENING.label, qty: STATED_OPENING.qty, unit: STATED_OPENING.unit },
      },
      victim,
      foreign.sessionId,
    );
  });
});

describe("a batch is refused whole when any member names a foreign line", () => {
  test("one foreign step writes nothing — not even the caller's own legitimate step", async () => {
    const own = await geometrylessRow(home.billId);
    const victim = await geometrylessRow(foreign.billId);
    const ownBefore = await stateOf(own);

    await refusedAndUntouched(
      {
        kind: "batch",
        commands: [
          { kind: "set-row-typical", rowId: own, typical: 4 },
          { kind: "set-row-typical", rowId: victim, typical: 99 },
        ],
      },
      victim,
      foreign.sessionId,
    );

    assert.deepEqual(await stateOf(own), ownBefore, "the caller's own step rolled back with the batch");
    assert.equal(await auditCountForRow(own), 0, "and left no audit entry of its own");
  });

  test("a merge that names a foreign line cannot borrow it into the caller's take-off", async () => {
    const own = await geometrylessRow(home.billId);
    const victim = await geometrylessRow(foreign.billId);

    await refusedAndUntouched({ kind: "merge-geometries", rowIds: [own, victim] }, victim, foreign.sessionId);
  });
});
