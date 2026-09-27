// What Panda AI can and cannot say about a saved workbook, driven against real
// Postgres.
//
// No LLM is involved and none can be: this suite calls `preconWorkbookNotes`
// directly, the same function the `get_precon_boq` tool calls, so what is
// asserted here is exactly what would reach a model — with no network, no key
// and no prompt in the loop. Asserting on the model's prose instead would test
// nothing, because the prose can change while the data stays wrong.
//
// Three properties, and all three need a real database:
//
//   1. SCOPE. A workbook is reachable only through its take-off's project.
//      Proving that needs two organisations, two projects and two real rows.
//   2. FRESHNESS. The stored snapshot holds the figures of the LAST SAVE. The
//      failure being guarded is a saved 44 quoted as current after a remeasure
//      moved it to 52, and it only exists once something has actually been
//      saved and then moved.
//   3. NO HIDDEN FAN-OUT. A read must not start a calculation worker. The
//      worker registry is watched across the read, so "SQL only" is measured
//      rather than asserted from the imports.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import {
  connectTestDatabase,
  dropEditorFixture,
  seedEditorFixture,
  type EditorFixture,
} from "../pdf-takeoff/editor-db-fixture.ts";
import { billSheetIdFor } from "../pdf-takeoff/workbook/layout.ts";
import { workbookService } from "../pdf-takeoff/workbook/service.ts";
import { onWorkerLifecycle } from "../pdf-takeoff/workbook/worker-client.ts";
import { WORKBOOK_AGENT_LIMITS } from "../pdf-takeoff/workbook/agent-read.ts";
import { agentRepository } from "./repository.ts";
import { preconWorkbookNotes, type PreconWorkbookSummary } from "./precon-workbook.ts";
import type { WorkbookCell, WorkbookSnapshot } from "../pdf-takeoff/workbook/engine-types.ts";
import type { WorkbookDocument } from "../pdf-takeoff/workbook/types.ts";

let db: Knex;
let mine: EditorFixture;
let theirs: EditorFixture;

const service = () => workbookService(db);

const SCRATCH_SHEET = "scratch-agent";
const SCRATCH_NAME = "Rate build-up";

async function seedLines(fixture: EditorFixture): Promise<void> {
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
  ]);
}

/** The served document with a free-column formula and a scratch worksheet added. */
function withUserWork(document: WorkbookDocument, billId: string): WorkbookSnapshot {
  const snapshot = structuredClone(document.snapshot) as WorkbookSnapshot & {
    sheetOrder: string[];
    sheets: Record<string, { id: string; name: string; rowCount: number; columnCount: number; cellData: Record<string, Record<string, WorkbookCell>> }>;
  };
  const bill = snapshot.sheets[billSheetIdFor(billId)]!;
  // The formula AND the figure the grid was showing when it was saved. A client
  // may legitimately send both, so the stored snapshot really does hold 88 —
  // which after the remeasure to 52 is a stale number the assistant must never
  // repeat. Without this `v` the "formula cells carry no value" rule would be
  // asserted against a fixture that could not break it.
  bill.cellData["1"] = { ...bill.cellData["1"], "6": { f: "=D2*2", v: 88, t: 2 } };
  snapshot.sheets[SCRATCH_SHEET] = {
    id: SCRATCH_SHEET,
    name: SCRATCH_NAME,
    rowCount: 40,
    columnCount: 8,
    cellData: {
      "0": { "0": { v: "Preliminaries allowance", t: 1 }, "1": { v: 25000, t: 2 } },
      "1": { "0": { v: "Measured plus prelims", t: 1 }, "1": { f: `=SUM('${bill.name}'!F2:F3)+B1` } },
    },
  };
  snapshot.sheetOrder.push(SCRATCH_SHEET);
  return snapshot;
}

async function saveUserWork(fixture: EditorFixture): Promise<void> {
  const document = await service().read(fixture.sessionId, fixture.actor);
  await service().save(
    fixture.sessionId,
    {
      operationId: `op_${randomUUID()}`,
      expectedVersion: document.version,
      expectedSourceFingerprint: document.sourceFingerprint,
      snapshot: withUserWork(document, fixture.billId),
    },
    fixture.actor,
  );
}

const readFor = (projectId: string): Promise<PreconWorkbookSummary> =>
  preconWorkbookNotes(agentRepository(db), db, projectId);

before(async () => {
  db = connectTestDatabase();
  mine = await seedEditorFixture(db, "wb-agent-mine");
  theirs = await seedEditorFixture(db, "wb-agent-theirs");
  await seedLines(mine);
  await seedLines(theirs);
  await saveUserWork(mine);
  await saveUserWork(theirs);
});

after(async () => {
  if (mine) await dropEditorFixture(db, mine);
  if (theirs) await dropEditorFixture(db, theirs);
  await db.destroy();
});

describe("a workbook is reachable only through its own project", () => {
  test("reports this project's workbook and no other", async () => {
    const summary = await readFor(mine.projectId);
    assert.equal(summary.workbooksReported, 1);
    assert.equal(summary.workbooks[0]?.sessionId, mine.sessionId);
  });

  test("never reaches another organisation's take-off, even though one exists", async () => {
    const summary = await readFor(mine.projectId);
    const reached = summary.workbooks.map((workbook) => workbook.sessionId);
    assert.equal(reached.includes(theirs.sessionId), false);
  });

  test("answers a project that has no workbook with nothing, not with someone else's", async () => {
    const summary = await readFor(`prj_absent_${randomUUID().slice(0, 8)}`);
    assert.deepEqual(summary.workbooks, []);
    assert.equal(summary.workbooksTruncated, false);
  });
});

describe("what a cell is allowed to say", () => {
  test("reports a stored formula verbatim, with the bill line it reaches", async () => {
    const { workbooks } = await readFor(mine.projectId);
    const cell = workbooks[0]!.cells.find((entry) => entry.ref === "G2");
    assert.equal(cell?.formula, "=D2*2");
    assert.equal(cell?.explains, "Mass concrete in trenches");
    assert.equal(cell?.sourceRowId, `${mine.sessionId}_r1`);
    assert.equal(cell?.sourceState, "bound");
    assert.equal(cell?.sourceBasis, "stated");
  });

  test("carries a value a PERSON typed", async () => {
    const { workbooks } = await readFor(mine.projectId);
    const typed = workbooks[0]!.cells.find((entry) => entry.sheet === SCRATCH_NAME && entry.ref === "B1");
    assert.equal(typed?.enteredValue, 25000);
    assert.equal(typed?.formula, null);
  });

  test("gives a formula cell NO value, even though the client stored one beside it", async () => {
    const { workbooks } = await readFor(mine.projectId);
    const cell = workbooks[0]!.cells.find((entry) => entry.ref === "G2");
    assert.equal(cell?.formula, "=D2*2", "the fixture's formula cell is the one being read");
    assert.equal(cell?.enteredValue, null, "the client's cached 88 was reported as a value");

    const formulas = workbooks[0]!.cells.filter((entry) => entry.formula !== null);
    assert.ok(formulas.length > 1);
    assert.equal(formulas.every((entry) => entry.enteredValue === null), true);
  });

  test("keeps the generated bill columns out, so no figure from the last save is quoted", async () => {
    const { workbooks } = await readFor(mine.projectId);
    const values = workbooks[0]!.cells.map((entry) => entry.enteredValue);
    assert.equal(values.includes(44), false, "the saved quantity was reported as if it were a figure");
    assert.equal(values.includes(220000), false, "the saved amount was reported as if it were a figure");
    assert.equal(values.includes("Mass concrete in trenches"), false, "a generated description leaked in");
  });

  test("reports the Summary's bill total as a formula, because that is what explains it", async () => {
    const { workbooks } = await readFor(mine.projectId);
    const total = workbooks[0]!.cells.find((entry) => entry.sheetKind === "summary" && entry.formula !== null);
    assert.match(total!.formula!, /^=SUM\(/);
    assert.equal(total!.enteredValue, null);
  });
});

describe("figures that have moved are labelled, never restated", () => {
  test("says the workbook is current while nothing has moved", async () => {
    const { workbooks } = await readFor(mine.projectId);
    assert.equal(workbooks[0]?.figureState, "current");
    assert.equal(workbooks[0]?.reviewBasis.sourcesMoved, false);
  });

  test("says the measurements moved after a remeasure, and still quotes no figure", async () => {
    await db("precon_boq_rows")
      .where({ id: `${mine.sessionId}_r1` })
      .update({ qty: 52, qty_gross: 52, amount: 260000 });
    try {
      const { workbooks } = await readFor(mine.projectId);
      assert.equal(workbooks[0]?.figureState, "measurements_moved_since_last_save");
      assert.equal(workbooks[0]?.reviewBasis.sourcesMoved, true);
      const values = workbooks[0]!.cells.map((entry) => entry.enteredValue);
      assert.equal(values.includes(44), false, "the superseded quantity was quoted");
      assert.equal(values.includes(52), false, "a live figure was quoted from the workbook rather than the bill");
    } finally {
      await db("precon_boq_rows")
        .where({ id: `${mine.sessionId}_r1` })
        .update({ qty: 44, qty_gross: 44, amount: 220000 });
    }
  });

  test("marks a withdrawn line's cells as #REF! rather than reporting a number", async () => {
    await db("precon_boq_rows")
      .where({ id: `${mine.sessionId}_r2` })
      .update({ deleted_at: new Date() });
    try {
      const { workbooks } = await readFor(mine.projectId);
      const withdrawn = workbooks[0]!.cells.filter((entry) => entry.sourceState === "withdrawn");
      assert.ok(withdrawn.length > 0, "the withdrawn line was not reported at all");
      assert.equal(withdrawn.every((entry) => entry.error === "#REF!"), true);
      assert.equal(withdrawn.every((entry) => entry.enteredValue === null), true);
      assert.equal(workbooks[0]?.reviewBasis.withdrawn, 1);
    } finally {
      await db("precon_boq_rows").where({ id: `${mine.sessionId}_r2` }).update({ deleted_at: null });
    }
  });

  test("counts the review standing of the lines behind the workbook", async () => {
    const { workbooks } = await readFor(mine.projectId);
    assert.equal(workbooks[0]?.reviewBasis.boundRows, 2);
    assert.equal(workbooks[0]?.reviewBasis.verified, 1);
    assert.equal(workbooks[0]?.reviewBasis.needsReview, 1);
  });
});

describe("the read is bounded and starts no calculation", () => {
  test("starts no worker thread, so a question cannot fan out into calculations", async () => {
    const spawned: number[] = [];
    const stop = onWorkerLifecycle((event, threadId) => {
      if (event === "spawn") spawned.push(threadId);
    });
    try {
      await readFor(mine.projectId);
      await readFor(theirs.projectId);
    } finally {
      stop();
    }
    assert.deepEqual(spawned, [], "the agent read spawned a Univer worker");
  });

  test("declares its own ceilings rather than leaving them to be guessed", async () => {
    const summary = await readFor(mine.projectId);
    assert.equal(summary.limits.maxWorkbooks, WORKBOOK_AGENT_LIMITS.maxWorkbooks);
    assert.equal(summary.limits.maxCellsPerWorkbook, WORKBOOK_AGENT_LIMITS.maxCellsPerWorkbook);
  });

  test("reports every cell it holds when there are fewer than the cap", async () => {
    const summary = await readFor(mine.projectId);
    const workbook = summary.workbooks[0]!;
    assert.equal(workbook.cellsTruncated, false);
    assert.equal(workbook.cellsReported, workbook.cellsPresent);
    assert.ok(workbook.cellsReported <= WORKBOOK_AGENT_LIMITS.maxCellsPerWorkbook);
  });
});
