import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkbookEngine, evaluateWorkbook } from "./engine.ts";
import { isWorkbookRejection, type WorkbookRejectionReason } from "./engine-errors.ts";
import { WORKBOOK_CONCURRENCY, WORKBOOK_DEADLINE_MS, WORKBOOK_QUEUE_DEPTH } from "./engine-limits.ts";
import type { CalculatedCell, EvaluateWorkbookResult } from "./engine-types.ts";
import { liveWorkerCount, onWorkerLifecycle } from "./worker-client.ts";
import {
  cyclicCandidate,
  diamondCandidate,
  PRICED_ROWS_CELL_COUNT,
  PRICED_ROWS_QTY_TOTAL,
  PRICED_ROWS_TOTAL,
  pricedRowsCandidate,
  takeoffCandidate,
  type CandidateWorkbook,
} from "./workbook-fixtures.ts";

// The engine, running for real: every case below spawns an actual Univer worker
// and reads actual calculated values. Nothing here is stubbed, and nothing
// asserts against a value this module produced itself.
//
// 44 -> 220000 and 52 -> 260000 are the feasibility report's published figures.
// They are asserted exactly, in both directions, because "the number changed"
// is not the contract — "a remeasure updates quantities without touching a
// single formula" is.

function cellAt(result: EvaluateWorkbookResult, sheetId: string, row: number, column: number): CalculatedCell {
  const cell = result.values[sheetId]?.[String(row)]?.[String(column)];
  assert.ok(cell, `expected a calculated cell at ${sheetId}!r${row}c${column}`);
  return cell;
}

async function reasonOf(run: () => Promise<unknown>): Promise<WorkbookRejectionReason | null> {
  try {
    await run();
    return null;
  } catch (error) {
    if (!isWorkbookRejection(error)) throw error;
    return error.reason;
  }
}

test("the default engine is bounded exactly as the contract specifies", () => {
  assert.equal(WORKBOOK_CONCURRENCY, 1, "one calculation at a time by default");
  assert.equal(WORKBOOK_QUEUE_DEPTH, 8, "eight may wait");
  assert.equal(WORKBOOK_DEADLINE_MS, 15_000, "fifteen second worker deadline");
});

test("a real worker calculates the takeoff chain: 44 net, 220000 amount", async () => {
  const result = await evaluateWorkbook(takeoffCandidate(24));

  assert.equal(cellAt(result, "takeoff", 4, 1).value, 44, "(24-2)*2");
  assert.equal(cellAt(result, "takeoff", 9, 1).value, 60, "SUM(B7:B9)");
  assert.equal(cellAt(result, "summary", 0, 1).value, 44, "cross-sheet reference to Takeoff!B5");
  assert.equal(cellAt(result, "summary", 2, 1).value, 220_000, "44 * 5000");
  assert.equal(cellAt(result, "summary", 3, 1).value, 220, "ROUND(220000/1000, 1)");
  assert.equal(cellAt(result, "summary", 4, 1).value, "OVER", "IF over the threshold");
  assert.deepEqual([...result.errors], [], "a clean workbook reports no cell errors");
});

test("a remeasure moves the quantities to 52/260000 and rewrites no formula", async () => {
  const before = await evaluateWorkbook(takeoffCandidate(24));
  const after = await evaluateWorkbook(takeoffCandidate(28));

  assert.equal(cellAt(after, "takeoff", 4, 1).value, 52, "(28-2)*2");
  assert.equal(cellAt(after, "summary", 0, 1).value, 52, "the cross-sheet reference followed");
  assert.equal(cellAt(after, "summary", 2, 1).value, 260_000, "52 * 5000");
  assert.equal(cellAt(after, "summary", 3, 1).value, 260, "ROUND re-evaluated");
  assert.equal(cellAt(after, "summary", 4, 1).value, "OVER");

  for (const [sheetId, row, column] of [
    ["takeoff", 4, 1],
    ["takeoff", 9, 1],
    ["summary", 0, 1],
    ["summary", 2, 1],
    ["summary", 3, 1],
    ["summary", 4, 1],
  ] as const) {
    assert.equal(
      cellAt(after, sheetId, row, column).formula,
      cellAt(before, sheetId, row, column).formula,
      `${sheetId}!r${row}c${column} kept its formula text through the remeasure`,
    );
  }
  assert.equal(cellAt(after, "takeoff", 4, 1).formula, "=(B2-B3)*B4", "and it is the text the user wrote");
  assert.equal(cellAt(after, "takeoff", 1, 1).formula, null, "the measured source cell is a plain number");
  assert.equal(cellAt(after, "takeoff", 1, 1).value, 28);
});

test("the validated snapshot is echoed back unchanged", async () => {
  const candidate = takeoffCandidate(24);
  const result = await evaluateWorkbook(candidate);

  assert.equal(result.snapshot.id, candidate.id);
  assert.deepEqual([...result.snapshot.sheetOrder], ["takeoff", "summary"]);
  assert.equal(result.snapshot.sheets.takeoff?.cellData[4]?.[1]?.f, "=(B2-B3)*B4");
  assert.equal(result.snapshot.sheets.summary?.cellData[0]?.[1]?.f, "=Takeoff!B5");
  assert.equal(result.populatedCells, 28, "every populated cell was accounted for against the bound");
});

test("self, mutual and cross-sheet cycles are all rejected, and no value is published", async () => {
  for (const shape of ["self", "mutual", "cross-sheet"] as const) {
    const reason = await reasonOf(() => evaluateWorkbook(cyclicCandidate(shape, `wb-cyc-${shape}`)));
    assert.equal(reason, "cyclic_formula", `${shape} cycle must be refused`);
  }

  // The rejection has to name the loop, or a user cannot find it.
  try {
    await evaluateWorkbook(cyclicCandidate("mutual", "wb-cyc-named"));
    assert.fail("expected a cyclic workbook to be refused");
  } catch (error) {
    assert.ok(isWorkbookRejection(error, "cyclic_formula"));
    assert.ok(error.cycles.length > 0, "the rejection names at least one cycle");
    assert.match(error.cycles.join(" "), /takeoff!r\d+c\d+/, "and names it by cell");
    assert.equal(error.statusCode, 422);
  }
});

test("an acyclic chain, diamond and range SUM are NOT mistaken for cycles", async () => {
  // Without this control, a gate that rejected every workbook would pass every
  // cycle test above.
  const result = await evaluateWorkbook(diamondCandidate());
  assert.equal(cellAt(result, "s1", 0, 1).value, 20, "=A1*2");
  assert.equal(cellAt(result, "s1", 0, 2).value, 15, "=A1+5");
  assert.equal(cellAt(result, "s1", 0, 3).value, 35, "the diamond joins at =B1+C1");
  assert.equal(cellAt(result, "s1", 0, 4).value, 80, "=SUM(A1:D1)");
  assert.equal(cellAt(result, "s1", 1, 0).value, 70, "=D1*2");
  assert.equal(cellAt(result, "s1", 1, 1).value, 150, "=A2+E1");
});

test("two concurrent jobs sharing one workbook id return their own answers", async () => {
  // The spike reproduced this as a real corruption: six in-process instances
  // sharing a unit id returned each other's numbers. A worker per job is the
  // reason it cannot happen here, so the duplicate id is deliberate.
  const engine = createWorkbookEngine({ concurrency: 2, maxQueued: 4 });
  const [a, b] = await Promise.all([
    engine.evaluateWorkbook(takeoffCandidate(24, "wb-shared")),
    engine.evaluateWorkbook(takeoffCandidate(40, "wb-shared")),
  ]);

  assert.equal(cellAt(a, "takeoff", 4, 1).value, 44, "(24-2)*2");
  assert.equal(cellAt(a, "summary", 2, 1).value, 220_000);
  assert.equal(cellAt(b, "takeoff", 4, 1).value, 76, "(40-2)*2");
  assert.equal(cellAt(b, "summary", 2, 1).value, 380_000);
  assert.notEqual(
    cellAt(a, "summary", 2, 1).value,
    cellAt(b, "summary", 2, 1).value,
    "identical results would mean one job read the other's registry",
  );
  assert.equal(engine.active, 0, "both workers were released");
});

test("a failing job does not poison the jobs beside it", async () => {
  const engine = createWorkbookEngine({ concurrency: 3, maxQueued: 4 });
  const outcomes = await Promise.allSettled([
    engine.evaluateWorkbook(takeoffCandidate(24, "wb-neighbour")),
    engine.evaluateWorkbook(cyclicCandidate("mutual", "wb-neighbour")),
    engine.evaluateWorkbook(takeoffCandidate(28, "wb-neighbour")),
  ]);

  assert.equal(outcomes[0]?.status, "fulfilled");
  assert.equal(outcomes[1]?.status, "rejected");
  assert.equal(outcomes[2]?.status, "fulfilled");
  if (outcomes[0]?.status === "fulfilled") assert.equal(cellAt(outcomes[0].value, "summary", 2, 1).value, 220_000);
  if (outcomes[2]?.status === "fulfilled") assert.equal(cellAt(outcomes[2].value, "summary", 2, 1).value, 260_000);
  assert.equal(engine.active, 0);
});

test("a job past its deadline is terminated and its slot released", async () => {
  const engine = createWorkbookEngine({ deadlineMs: 1 });
  assert.equal(await reasonOf(() => engine.evaluateWorkbook(takeoffCandidate(24))), "timeout");
  assert.equal(engine.active, 0, "the terminated worker did not keep its slot");
  assert.equal(engine.queued, 0);
  // A free slot is not proof the thread died; the thread count is.
  assert.equal(liveWorkerCount(), 0, "the worker thread had exited before the timeout surfaced");

  // The engine still works afterwards: the deadline killed a worker, not the service.
  const engineAfter = createWorkbookEngine();
  const result = await engineAfter.evaluateWorkbook(takeoffCandidate(24));
  assert.equal(cellAt(result, "summary", 2, 1).value, 220_000);
});

test("a full queue refuses with 429 rather than queueing without limit", async () => {
  const engine = createWorkbookEngine({ concurrency: 1, maxQueued: 1 });
  const first = engine.evaluateWorkbook(takeoffCandidate(24, "wb-q1"));
  const second = engine.evaluateWorkbook(takeoffCandidate(24, "wb-q2"));
  const third = engine.evaluateWorkbook(takeoffCandidate(24, "wb-q3"));

  await assert.rejects(third, (error: unknown) => {
    assert.ok(isWorkbookRejection(error, "busy"), "the third caller is told to retry");
    assert.equal(error.statusCode, 429);
    return true;
  });

  await Promise.all([first, second]);
  assert.equal(engine.active, 0);
  assert.equal(engine.queued, 0);
});

test("an abandoned caller takes its worker with it", async () => {
  const engine = createWorkbookEngine();

  const started = new AbortController();
  const inFlight = engine.evaluateWorkbook(takeoffCandidate(24), { signal: started.signal });
  setTimeout(() => started.abort(), 30);
  assert.equal(await reasonOf(() => inFlight), "aborted");
  assert.equal(engine.active, 0, "the worker was terminated, not left calculating");
  assert.equal(liveWorkerCount(), 0, "and the thread had actually exited before the caller was told");

  const already = new AbortController();
  already.abort();
  assert.equal(
    await reasonOf(() => engine.evaluateWorkbook(takeoffCandidate(24), { signal: already.signal })),
    "aborted",
  );
  assert.equal(engine.active, 0, "an already-abandoned caller never spawns a worker at all");
  assert.equal(liveWorkerCount(), 0);
});

test("a formula error is reported explicitly and its value is null, never 0", async () => {
  const candidate: CandidateWorkbook = takeoffCandidate(24, "wb-errors");
  const takeoff = candidate.sheets.takeoff;
  assert.ok(takeoff);
  takeoff.cellData[20] = { 1: { f: "=1/0" }, 2: { f: "=B5+1" } };

  const result = await evaluateWorkbook(candidate);
  const divideByZero = result.errors.find((error) => error.row === 20 && error.column === 1);

  assert.ok(divideByZero, "the divide-by-zero cell is reported as an error");
  assert.equal(divideByZero.code, "#DIV/0!");
  assert.equal(divideByZero.sheetId, "takeoff");
  assert.equal(divideByZero.formula, "=1/0", "the error names the formula that produced it");
  assert.equal(cellAt(result, "takeoff", 20, 1).value, null, "an error is null, not 0");

  for (const error of result.errors) {
    assert.notEqual(cellAt(result, error.sheetId, error.row, error.column).value, 0);
  }
  assert.equal(cellAt(result, "takeoff", 20, 2).value, 45, "a healthy cell beside it still calculates");
});

test("an indirect cycle is refused at the door, before a worker is ever spawned", async () => {
  // A31 = _xlfn.INDIRECT("A32")+1 and A32 = A31 is a genuine circular
  // reference that the engine's dependency graph cannot see: an INDIRECT edge
  // is constructed at calculation time, so the cycle gate downstream would be
  // walking a graph that does not describe what will actually be read.
  // Refusing INDIRECT — under every spelling — is what closes that hole.
  let spawns = 0;
  const stop = onWorkerLifecycle((event) => {
    if (event === "spawn") spawns += 1;
  });
  try {
    const candidate = takeoffCandidate(24, "wb-indirect-cycle");
    const takeoff = candidate.sheets.takeoff;
    assert.ok(takeoff);
    takeoff.cellData[30] = { 0: { f: '=_xlfn.INDIRECT("A32")+1' } };
    takeoff.cellData[31] = { 0: { f: "=A31" } };

    assert.equal(await reasonOf(() => evaluateWorkbook(candidate)), "unsupported_formula");
    assert.equal(spawns, 0, "nothing was calculated, so nothing could have been published");
  } finally {
    stop();
  }
});

test("an unsupported-but-safe function is the engine's #NAME?, not a safety refusal", async () => {
  const candidate = takeoffCandidate(24, "wb-unknown-fn");
  const takeoff = candidate.sheets.takeoff;
  assert.ok(takeoff);
  takeoff.cellData[30] = { 0: { f: "=NOSUCHFUNC(1)" }, 1: { f: "=_xlfn.CONCAT(B2,B3)" } };

  const result = await evaluateWorkbook(candidate);
  const unknown = result.errors.find((error) => error.row === 30 && error.column === 0);

  assert.ok(unknown, "an unknown function is reported as a cell error");
  assert.equal(unknown.code, "#NAME?", "by the engine, not by a name blocklist");
  assert.equal(cellAt(result, "takeoff", 30, 0).value, null, "and its value is null, never 0");
  // The same prefix that must not smuggle RANDARRAY past the gate must also not
  // break an ordinary Excel-round-tripped formula: CONCAT("24","2").
  assert.equal(cellAt(result, "takeoff", 30, 1).value, "242");
});

test("1000 priced rows calculate exactly, within the populated-cell bound", async () => {
  const result = await evaluateWorkbook(pricedRowsCandidate());

  assert.equal(result.populatedCells, PRICED_ROWS_CELL_COUNT, "4008 cells, inside the 10000 cap");
  assert.equal(cellAt(result, "takeoff", 1, 3).value, 120, "row 1: ROUND(1*100*1.2, 2)");
  assert.equal(cellAt(result, "takeoff", 1000, 3).value, 120_000, "row 1000: ROUND(1000*100*1.2, 2)");
  assert.equal(cellAt(result, "summary", 0, 1).value, PRICED_ROWS_TOTAL, "SUM over 1000 cross-sheet rows");
  assert.equal(cellAt(result, "summary", 1, 1).value, PRICED_ROWS_QTY_TOTAL);
  assert.deepEqual([...result.errors], [], "no row drifted into an error");
  assert.ok(result.durationMs > 0, "the job reported how long it actually took");
});
