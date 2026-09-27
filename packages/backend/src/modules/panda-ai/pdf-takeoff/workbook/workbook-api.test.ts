// The persisted workbook against real Postgres: what a retry is answered with,
// what the rest of the building is told, and what a refusal leaves behind.
//
// Every claim here is a claim about the database and the transaction around it
// — a partial unique index making a retry idempotent, a rollback leaving no
// audit row, a broadcast that must not escape a transaction that aborted. None
// of them can be made by a double, so this suite FAILS rather than skips when
// no database is configured.
//
// The property that needed a real database to state at all: a replay must hand
// back the ORIGINAL receipt beside a CURRENT document. A pure test cannot tell
// those apart, because nothing has happened in between.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { ConflictError } from "../../../../lib/errors.ts";
import {
  connectTestDatabase,
  dropEditorFixture,
  seedEditorFixture,
  type EditorFixture,
} from "../editor-db-fixture.ts";
import type { PreconChangeEvent } from "../service.ts";
import { workbookService } from "./service.ts";
import { workbookReverseService } from "./reverse.ts";
import { WorkbookProtectedError } from "./sanitize.ts";
import { billSheetIdFor } from "./layout.ts";
import type { WorkbookCell, WorkbookSnapshot } from "./engine-types.ts";
import type { WorkbookChangeEvent, WorkbookDocument, WorkbookSaveRequest } from "./types.ts";

let db: Knex;
let fixture: EditorFixture;
let published: PreconChangeEvent[] = [];

const publish = (_sessionId: string, event: PreconChangeEvent): void => {
  published.push(event);
};

const service = () => workbookService(db, publish);
const reverser = () => workbookReverseService(db, service(), publish);

const opId = (): string => `op_${randomUUID()}`;

const workbookEvents = (): WorkbookChangeEvent[] =>
  published.filter((event): event is WorkbookChangeEvent => event.type === "workbook.updated");

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "workbook-api");
  await db("precon_boq_rows").insert([
    {
      id: `${fixture.sessionId}_r1`,
      bill_id: fixture.billId,
      sort: 0,
      row_type: "item",
      code: "E10",
      description: "Mass concrete in trenches",
      unit: "m3",
      qty_gross: 44,
      qty: 44,
      rate: 5000,
      amount: 220000,
      deductions: JSON.stringify([]),
      status: "needs_review",
      origin: "ai",
    },
    {
      id: `${fixture.sessionId}_r2`,
      bill_id: fixture.billId,
      sort: 1,
      row_type: "item",
      code: "E20",
      description: "Blinding",
      unit: "m2",
      qty_gross: 120,
      qty: 120,
      rate: 1200,
      amount: 144000,
      deductions: JSON.stringify([]),
      status: "verified",
      origin: "ai",
    },
    {
      id: `${fixture.sessionId}_r3`,
      bill_id: fixture.billId,
      sort: 2,
      row_type: "item",
      code: "E30",
      description: "Allowance, not yet priced",
      unit: "nr",
      qty_gross: 1,
      qty: 1,
      rate: null,
      amount: null,
      deductions: JSON.stringify([]),
      status: "ai_generated",
      origin: "ai",
    },
  ]);
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const read = (): Promise<WorkbookDocument> => service().read(fixture.sessionId, fixture.actor);

/** The served document with one free-column cell set, ready to send back. */
function withFreeCell(document: WorkbookDocument, row: number, text: string): WorkbookSnapshot {
  const snapshot = structuredClone(document.snapshot) as WorkbookSnapshot & {
    sheets: Record<string, { cellData: Record<string, Record<string, WorkbookCell>> }>;
  };
  const sheet = snapshot.sheets[billSheetIdFor(fixture.billId)]!;
  sheet.cellData[String(row)] = { ...sheet.cellData[String(row)], "6": { v: text, t: 1 } };
  return snapshot;
}

/**
 * The served document with a rate echoed into the grid beside the patch that
 * carries its authority. The two MUST agree — a patch whose cell still shows
 * the old figure is refused, which is the contract the frontend is handed.
 */
function withRate(document: WorkbookDocument, row: number, rate: number): WorkbookSnapshot {
  const snapshot = structuredClone(document.snapshot) as WorkbookSnapshot & {
    sheets: Record<string, { cellData: Record<string, Record<string, WorkbookCell>> }>;
  };
  const line = snapshot.sheets[billSheetIdFor(fixture.billId)]!.cellData[String(row)]!;
  const qty = Number(line["3"]?.v ?? 0);
  line["4"] = { v: rate, t: 2 };
  line["5"] = { v: Math.round(qty * rate * 100) / 100, t: 2 };
  return snapshot;
}

function saveRequest(document: WorkbookDocument, snapshot: WorkbookSnapshot): WorkbookSaveRequest {
  return {
    operationId: opId(),
    expectedVersion: document.version,
    expectedSourceFingerprint: document.sourceFingerprint,
    snapshot,
  };
}

async function auditCount(operationId: string): Promise<number> {
  const row = await db("precon_audit_events").where({ operation_id: operationId }).count("* as n").first();
  return Number(row?.["n"] ?? 0);
}

const storedVersion = async (): Promise<number | null> => {
  const row = await db("precon_workbooks").where({ session_id: fixture.sessionId }).first();
  return row ? Number(row.version) : null;
};

describe("a committed save announces itself exactly once", () => {
  test("the first save writes version 1 and broadcasts one workbook.updated", async () => {
    published = [];
    const document = await read();
    assert.equal(document.version, 0, "nothing saved yet");

    const request = saveRequest(document, withFreeCell(document, 1, "first"));
    const result = await service().save(fixture.sessionId, request, fixture.actor);

    assert.equal(result.replayed, false);
    assert.equal(result.receipt.version, 1);
    assert.equal(result.receipt.operationId, request.operationId);
    assert.equal(await storedVersion(), 1);

    const events = workbookEvents();
    assert.equal(events.length, 1, "exactly one broadcast for one commit");
    assert.equal(events[0]?.sessionId, fixture.sessionId);
    assert.equal(events[0]?.version, 1);
    assert.equal(events[0]?.actor, fixture.actor);
    assert.equal(events[0]?.action, "workbook_edited");
    assert.equal(events[0]?.eventId, result.eventId);
    assert.deepEqual(events[0]?.rows, [], "no bill line moved, so none is named");
  });

  test("a rate patch names the bill lines it moved, so a stale row cache is dropped too", async () => {
    published = [];
    const document = await read();
    const rowId = `${fixture.sessionId}_r1`;
    const before = await db("precon_boq_rows").where({ id: rowId }).first();

    const result = await service().save(
      fixture.sessionId,
      {
        ...saveRequest(document, withRate(document, 1, 5500)),
        rowPatches: [{ rowId, version: Number(before.version), rate: 5500 }],
      },
      fixture.actor,
    );

    const moved = await db("precon_boq_rows").where({ id: rowId }).first();
    assert.equal(Number(moved.rate), 5500);
    assert.equal(Number(moved.version), Number(before.version) + 1);

    const events = workbookEvents();
    assert.equal(events.length, 1);
    assert.deepEqual(
      events[0]?.rows,
      [{ id: rowId, version: Number(moved.version) }],
      "the broadcast carries the line's FRESH version",
    );
    assert.equal(result.receipt.rows[0]?.version, Number(moved.version));
  });
});

describe("a retry is answered from the record, not from a second write", () => {
  test("the original receipt is unchanged by a later edit, while the document is current", async () => {
    published = [];
    const start = await read();
    const request = saveRequest(start, withFreeCell(start, 1, "original"));
    const original = await service().save(fixture.sessionId, request, fixture.actor);

    // Somebody else's save lands in between, so the workbook moves on.
    const between = await read();
    await service().save(fixture.sessionId, saveRequest(between, withFreeCell(between, 2, "later")), fixture.otherActor);
    const movedTo = await storedVersion();
    assert.equal(movedTo, original.receipt.version + 1, "the workbook really did move on");

    published = [];
    const retry = await service().save(fixture.sessionId, request, fixture.actor);

    assert.equal(retry.replayed, true);
    assert.equal(retry.eventId, original.eventId, "the same audit entry, not a new one");
    assert.deepEqual(retry.receipt, original.receipt, "the receipt is the ORIGINAL, byte for byte");
    assert.equal(retry.receipt.version, original.receipt.version);
    assert.equal(retry.document.version, movedTo, "the document is CURRENT, not frozen at the receipt");
    assert.notEqual(retry.document.version, retry.receipt.version, "the two genuinely differ here");

    assert.equal(workbookEvents().length, 0, "a replay changed nothing, so it announces nothing");
    assert.equal(await auditCount(request.operationId), 1, "recorded once, not twice");
    assert.equal(await storedVersion(), movedTo, "the retry wrote nothing");
  });

  test("the same id carrying different work is refused, and writes nothing", async () => {
    published = [];
    const document = await read();
    const request = saveRequest(document, withFreeCell(document, 1, "one"));
    await service().save(fixture.sessionId, request, fixture.actor);

    const versionAfterFirst = await storedVersion();
    published = [];
    const reused = await read();
    await assert.rejects(
      service().save(
        fixture.sessionId,
        { ...request, expectedVersion: reused.version, snapshot: withFreeCell(reused, 1, "two") },
        fixture.actor,
      ),
      ConflictError,
    );
    assert.equal(await storedVersion(), versionAfterFirst);
    assert.equal(workbookEvents().length, 0);
  });
});

describe("a refusal leaves nothing behind and tells nobody", () => {
  test("a paste over a measured quantity writes no row, no audit entry and no broadcast", async () => {
    published = [];
    const document = await read();
    const before = await storedVersion();

    const tampered = structuredClone(document.snapshot) as WorkbookSnapshot & {
      sheets: Record<string, { cellData: Record<string, Record<string, WorkbookCell>> }>;
    };
    tampered.sheets[billSheetIdFor(fixture.billId)]!.cellData["1"]!["3"] = { v: 9999, t: 2 };

    const request = saveRequest(document, tampered);
    await assert.rejects(service().save(fixture.sessionId, request, fixture.actor), WorkbookProtectedError);

    assert.equal(await storedVersion(), before, "the stored version did not move");
    assert.equal(await auditCount(request.operationId), 0, "no audit entry for a refusal");
    assert.equal(workbookEvents().length, 0, "nothing was announced");
  });

  test("a figure forged into a cell the bill left EMPTY writes nothing and announces nothing", async () => {
    published = [];
    const document = await read();
    const before = await storedVersion();
    const unpriced = `${fixture.sessionId}_r3`;
    const gridRow = String(
      document.layout.sheets.find((sheet) => sheet.billId === fixture.billId)!.bindings.find(
        (binding) => binding.rowId === unpriced,
      )!.gridRow,
    );

    const forged = structuredClone(document.snapshot) as WorkbookSnapshot & {
      sheets: Record<string, { cellData: Record<string, Record<string, WorkbookCell>> }>;
    };
    const line = forged.sheets[billSheetIdFor(fixture.billId)]!.cellData;
    assert.equal(line[gridRow]?.["4"], undefined, "the unpriced line really does render no rate cell");
    line[gridRow] = { ...line[gridRow], "4": { v: 9999, t: 2 }, "5": { v: 9999, t: 2 } };

    const request = saveRequest(document, forged);
    await assert.rejects(service().save(fixture.sessionId, request, fixture.actor), WorkbookProtectedError);

    assert.equal(await storedVersion(), before, "the workbook version did not move");
    assert.equal(await auditCount(request.operationId), 0, "no audit entry for a refusal");
    assert.equal(workbookEvents().length, 0, "nothing was announced");
    const row = await db("precon_boq_rows").where({ id: unpriced }).first();
    assert.equal(row.rate, null, "and the bill line is still unpriced");
    assert.equal(row.amount, null);
  });

  test("a stale expectedVersion is refused with no broadcast", async () => {
    published = [];
    const document = await read();
    const before = await storedVersion();
    const request = { ...saveRequest(document, document.snapshot), expectedVersion: document.version + 7 };

    await assert.rejects(service().save(fixture.sessionId, request, fixture.actor), ConflictError);
    assert.equal(await storedVersion(), before);
    assert.equal(await auditCount(request.operationId), 0);
    assert.equal(workbookEvents().length, 0);
  });

  test("a stale source fingerprint is refused with no broadcast", async () => {
    published = [];
    const document = await read();
    const before = await storedVersion();
    const request = { ...saveRequest(document, document.snapshot), expectedSourceFingerprint: "0".repeat(64) };

    await assert.rejects(service().save(fixture.sessionId, request, fixture.actor), ConflictError);
    assert.equal(await storedVersion(), before);
    assert.equal(workbookEvents().length, 0);
  });
});

describe("an undo is announced like any other committed change", () => {
  test("it broadcasts workbook_reversed, and its own retry announces nothing", async () => {
    const rowId = `${fixture.sessionId}_r1`;
    const start = await read();
    const rowBefore = await db("precon_boq_rows").where({ id: rowId }).first();
    const edit = await service().save(
      fixture.sessionId,
      {
        ...saveRequest(start, withRate(start, 1, 7777)),
        rowPatches: [{ rowId, version: Number(rowBefore.version), rate: 7777 }],
      },
      fixture.actor,
    );

    published = [];
    const current = await read();
    const reverseRequest = {
      operationId: opId(),
      expectedVersion: current.version,
      expectedSourceFingerprint: current.sourceFingerprint,
    };
    const undone = await reverser().reverse(fixture.sessionId, edit.eventId, reverseRequest, fixture.actor);

    assert.equal(undone.reversed, true);
    assert.ok(undone.reversed && undone.receipt.version === current.version + 1, "versions only go up");
    const events = workbookEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0]?.action, "workbook_reversed");
    assert.deepEqual(
      events[0]?.rows.map((row) => row.id),
      [rowId],
      "the restored bill line is named so its cache is dropped",
    );
    assert.equal(Number((await db("precon_boq_rows").where({ id: rowId }).first()).rate), Number(rowBefore.rate));

    published = [];
    const retry = await reverser().reverse(fixture.sessionId, edit.eventId, reverseRequest, fixture.actor);
    assert.ok(retry.reversed);
    assert.equal(retry.reversed && retry.replayed, true);
    assert.deepEqual(retry.reversed ? retry.receipt : null, undone.reversed ? undone.receipt : undefined);
    assert.equal(workbookEvents().length, 0, "a replayed undo announces nothing");
  });
});

describe("history is the actor's own, read back from the trail", () => {
  test("it lists this actor's entries and never a colleague's", async () => {
    const mine = await service().history(fixture.sessionId, fixture.actor);
    const theirs = await service().history(fixture.sessionId, fixture.otherActor);

    assert.ok(mine.operations.length > 0);
    assert.ok(mine.operations.every((entry) => entry.actor === fixture.actor));
    assert.ok(theirs.operations.every((entry) => entry.actor === fixture.otherActor));
    assert.ok(
      mine.operations.every((entry) => entry.toVersion > entry.fromVersion),
      "every recorded entry moved the version forward",
    );
  });
});
