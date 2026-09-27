// What the browser must REFUSE to send.
//
// One disagreement inside the generated block refuses the whole save, so each
// case here asserts the refusal AND that nothing legitimate was quietly kept.
// Rate and description are the two fields that may move, and they leave as row
// patches rather than as cells.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCandidate, isSendable } from "./candidate";
import { canonicalAmount } from "./protected";
import { BILL, document, rawFrom, setCell, SUMMARY } from "./workbook-fixture";
import { worksheetTargetOf } from "./univer-guards";
import { classifyWorkbookFailure } from "@/api/workbook-failure";
import { AxiosError } from "axios";
import type { WorkbookCell, WorkbookDocument, WorkbookSheetLayout } from "@/api/workbook-types";
describe("the generated block", () => {
  it("refuses a typed-over quantity and saves nothing", () => {
    const doc = document();
    const raw = setCell(rawFrom(doc), BILL, 1, 3, { v: 999, t: 2 });
    const candidate = buildCandidate(raw, doc);
    assert.equal(candidate.blocked.length, 1);
    assert.equal(candidate.blocked[0]!.field, "qty");
    assert.match(candidate.blocked[0]!.reason, /come from the drawings/);
    assert.equal(isSendable(candidate), false);
  });

  it("refuses a typed-over amount", () => {
    const doc = document();
    const raw = setCell(rawFrom(doc), BILL, 1, 5, { v: 1, t: 2 });
    assert.equal(buildCandidate(raw, doc).blocked[0]!.field, "amount");
  });

  it("refuses a write into a row reserved for the next measured line", () => {
    const doc = document();
    const raw = setCell(rawFrom(doc), BILL, 20, 3, { v: 5, t: 2 });
    const candidate = buildCandidate(raw, doc);
    assert.equal(candidate.blocked.length, 1);
    assert.match(candidate.blocked[0]!.reason, /reserved for a bill line/);
  });

  it("refuses a rate typed onto a withdrawn line", () => {
    const doc = document();
    const raw = setCell(rawFrom(doc), BILL, 3, 4, { v: 10, t: 2 });
    assert.match(buildCandidate(raw, doc).blocked[0]!.reason, /withdrawn/);
  });

  it("refuses a renamed bill worksheet, because every formula spells its name", () => {
    const doc = document();
    const raw = rawFrom(doc);
    (raw.sheets as Record<string, { name: string }>)[BILL]!.name = "Renamed";
    assert.match(buildCandidate(raw, doc).blocked[0]!.reason, /renamed/);
  });

  it("refuses a deleted bill worksheet and puts the server's copy back in the candidate", () => {
    const doc = document();
    const raw = rawFrom(doc);
    raw.sheetOrder = [SUMMARY, "scratch-1"];
    delete (raw.sheets as Record<string, unknown>)[BILL];
    const candidate = buildCandidate(raw, doc);
    assert.equal(isSendable(candidate), false);
    assert.ok(candidate.snapshot.sheetOrder.includes(BILL));
  });

  it("refuses a scratch worksheet that claims a reserved generated id", () => {
    const doc = document();
    const raw = rawFrom(doc);
    (raw.sheets as Record<string, unknown>)["wb-bill-forged"] = {
      id: "wb-bill-forged",
      name: "Mine",
      rowCount: 10,
      columnCount: 10,
      cellData: {},
    };
    (raw.sheetOrder as string[]).push("wb-bill-forged");
    assert.match(buildCandidate(raw, doc).blocked[0]!.reason, /reserved for a bill/);
  });

  it("lets a style change through: formatting never moves a figure", () => {
    const doc = document();
    const raw = setCell(rawFrom(doc), BILL, 1, 3, { v: 24, t: 2, s: { bl: 1 } });
    const candidate = buildCandidate(raw, doc);
    assert.ok(isSendable(candidate));
    const cell = candidate.snapshot.sheets[BILL]!.cellData["1"]!["3"]!;
    assert.equal(cell.v, 24, "the figure is still the server's");
    assert.ok(cell.s, "the person's formatting survived");
  });
});

describe("rates and descriptions", () => {
  it("lifts a rate edit into a row patch and recomputes the amount canonically", () => {
    const doc = document();
    const raw = setCell(rawFrom(doc), BILL, 1, 4, { v: 6000, t: 2 });
    const candidate = buildCandidate(raw, doc);

    assert.deepEqual(candidate.blocked, []);
    assert.deepEqual(candidate.rowPatches, [{ rowId: "pbr_a", version: 7, rate: 6000 }]);
    const line = candidate.snapshot.sheets[BILL]!.cellData["1"]!;
    assert.deepEqual(line["4"], { v: 6000, t: 2 }, "the echoed rate must agree with the patch");
    assert.deepEqual(line["5"], { v: 144000, t: 2 }, "24 x 6000, rounded as row-patch.ts rounds it");
  });

  it("rounds the amount to the penny exactly as the server does", () => {
    assert.equal(canonicalAmount(3, 0.005), 0.02);
    assert.equal(canonicalAmount(24, 6000), 144000);
    assert.equal(canonicalAmount(null, 6000), null);
  });

  it("prices a line that had no rate at all, adding the amount cell the server will add", () => {
    const doc = document();
    const raw = setCell(rawFrom(doc), BILL, 2, 4, { v: 250, t: 2 });
    const candidate = buildCandidate(raw, doc);
    assert.deepEqual(candidate.rowPatches, [{ rowId: "pbr_b", version: 4, rate: 250 }]);
    assert.deepEqual(candidate.snapshot.sheets[BILL]!.cellData["2"]!["5"], { v: 1250, t: 2 });
  });

  it("lifts a description edit into the same patch as the rate on that line", () => {
    const doc = document();
    const raw = rawFrom(doc);
    setCell(raw, BILL, 1, 1, { v: "Blockwork, 225mm", t: 1 });
    setCell(raw, BILL, 1, 4, { v: 6000, t: 2 });
    const candidate = buildCandidate(raw, doc);
    assert.deepEqual(candidate.rowPatches, [
      { rowId: "pbr_a", version: 7, description: "Blockwork, 225mm", rate: 6000 },
    ]);
  });

  it("refuses a rate expressed as a formula, because the bill line stores a figure", () => {
    const doc = document();
    const raw = setCell(rawFrom(doc), BILL, 1, 4, { f: "=G2*1.1" });
    assert.match(buildCandidate(raw, doc).blocked[0]!.reason, /cannot be a formula/);
  });

  it("refuses a rate typed as text rather than coercing it", () => {
    const doc = document();
    const raw = setCell(rawFrom(doc), BILL, 1, 4, { v: "6000", t: 1 });
    assert.match(buildCandidate(raw, doc).blocked[0]!.reason, /must be a number/);
  });

  it("refuses an emptied description instead of saving a nameless bill line", () => {
    const doc = document();
    const raw = setCell(rawFrom(doc), BILL, 1, 1, { v: "  ", t: 1 });
    assert.match(buildCandidate(raw, doc).blocked[0]!.reason, /must keep a description/);
  });

  it("says how to clear a rate rather than silently sending null the schema refuses", () => {
    const doc = document();
    const raw = setCell(rawFrom(doc), BILL, 1, 4, {});
    assert.match(buildCandidate(raw, doc).blocked[0]!.reason, /type 0/);
  });
});

/**
 * Row 1's stored amount is DELIBERATELY wrong: 44 x 5000 is 220000, not the
 * 219000 stored. `buildRowUpdatePatch` rewrites the amount of any row it
 * patches whenever it holds both figures, never asking which field moved — so
 * echoing the stored figure back on a description-only patch is a 422.
 */
function driftedDocument(): WorkbookDocument {
  const doc = document();
  const cells = doc.snapshot.sheets[BILL]!.cellData as Record<string, Record<string, WorkbookCell>>;
  cells["1"] = { ...cells["1"], "3": { v: 44, t: 2 }, "4": { v: 5000, t: 2 }, "5": { v: 219000, t: 2 } };
  return doc;
}

describe("a stored amount that has drifted from quantity x rate", () => {
  it("corrects it on a description-only patch, exactly as the server will", () => {
    const doc = driftedDocument();
    const raw = setCell(rawFrom(doc), BILL, 1, 1, { v: "Blockwork, 225mm", t: 1 });
    const candidate = buildCandidate(raw, doc);

    assert.deepEqual(candidate.blocked, [], "a description edit is not a protected-cell change");
    assert.deepEqual(candidate.rowPatches, [{ rowId: "pbr_a", version: 7, description: "Blockwork, 225mm" }]);
    assert.deepEqual(
      candidate.snapshot.sheets[BILL]!.cellData["1"]!["5"],
      { v: 220000, t: 2 },
      "44 x 5000 = 220000, not the stored 219000 the sanitizer would refuse",
    );
    assert.ok(isSendable(candidate));
  });

  it("corrects it on a rate patch too", () => {
    const doc = driftedDocument();
    const raw = setCell(rawFrom(doc), BILL, 1, 4, { v: 6000, t: 2 });
    const line = buildCandidate(raw, doc).snapshot.sheets[BILL]!.cellData["1"]!;
    assert.deepEqual(line["5"], { v: 264000, t: 2 }, "44 x 6000");
  });

  it("leaves an UNPATCHED row's drifted amount alone — the server does not touch it either", () => {
    const doc = driftedDocument();
    // Patch a different line entirely; row 1 keeps whatever is stored.
    const raw = setCell(rawFrom(doc), BILL, 2, 1, { v: "QA five markers, revised", t: 1 });
    const candidate = buildCandidate(raw, doc);

    assert.deepEqual(candidate.rowPatches, [
      { rowId: "pbr_b", version: 4, description: "QA five markers, revised" },
    ]);
    assert.deepEqual(
      candidate.snapshot.sheets[BILL]!.cellData["1"]!["5"],
      { v: 219000, t: 2 },
      "an unpatched row is echoed verbatim, drift and all",
    );
    assert.ok(isSendable(candidate));
  });

  it("writes no amount when the line has no rate, leaving the cell absent", () => {
    const doc = document();
    // Row 2 is the unpriced line: quantity 5, no rate, no amount cell at all.
    const raw = setCell(rawFrom(doc), BILL, 2, 1, { v: "QA five markers, revised", t: 1 });
    const line = buildCandidate(raw, doc).snapshot.sheets[BILL]!.cellData["2"]!;
    assert.equal(line["5"], undefined, "no rate means no amount, as `buildRowUpdatePatch` leaves it");
    assert.deepEqual(line["3"], { v: 5, t: 2 }, "the quantity is untouched");
  });

  it("writes no amount when the line has no quantity", () => {
    const doc = document();
    const cells = doc.snapshot.sheets[BILL]!.cellData as Record<string, Record<string, WorkbookCell>>;
    cells["1"] = { ...cells["1"], "3": { v: "", t: 1 }, "5": { v: 120000, t: 2 } };
    const raw = setCell(rawFrom(doc), BILL, 1, 1, { v: "Blockwork, 225mm", t: 1 });
    const line = buildCandidate(raw, doc).snapshot.sheets[BILL]!.cellData["1"]!;
    assert.deepEqual(line["5"], { v: 120000, t: 2 }, "a line with no quantity keeps the amount it had");
  });
});

describe("what a failed save is allowed to say", () => {
  const axiosFailure = (status: number, data: unknown): AxiosError => {
    const error = new AxiosError("Network Error");
    if (status > 0) {
      error.response = { status, data, statusText: "", headers: {}, config: { headers: {} } } as never;
    }
    return error;
  };

  it("carries the server's own words when there are any", () => {
    const failure = classifyWorkbookFailure(
      axiosFailure(422, { error: "That formula refers to itself.", code: "workbook_cyclic_formula" }),
    );
    assert.equal(failure.kind, "rejected");
    assert.equal(failure.message, "That formula refers to itself.");
  });

  it("never leaves the user with axios's bare 'Network Error'", () => {
    // The defect this pins: the banner that should carry this could not render,
    // so a dropped save said only "Not saved".
    const failure = classifyWorkbookFailure(axiosFailure(0, undefined));
    assert.equal(failure.kind, "unreachable");
    assert.notEqual(failure.message, "Network Error");
    assert.match(failure.message, /could not be reached/);
    assert.equal(failure.retryable, true, "a dropped save is the case where retrying is correct");
  });

  it("always has something to say, whatever the failure", () => {
    for (const [status, code] of [[409, null], [429, null], [403, null], [413, null], [500, null]] as const) {
      const failure = classifyWorkbookFailure(axiosFailure(status, code ? { code } : {}));
      assert.ok(failure.message.trim().length > 0, `status ${status} produced an empty message`);
    }
  });

  it("marks only the kinds where resending the same work is safe as retryable", () => {
    assert.equal(classifyWorkbookFailure(axiosFailure(0, undefined)).retryable, true);
    assert.equal(classifyWorkbookFailure(axiosFailure(429, {})).retryable, true);
    assert.equal(
      classifyWorkbookFailure(axiosFailure(422, { code: "workbook_protected" })).retryable,
      false,
      "resending a refused paste would only be refused again",
    );
  });
});

describe("which commands the address guard may judge", () => {
  const bill: WorkbookSheetLayout = {
    sheetId: "wb-bill-1",
    kind: "bill",
    billId: "b1",
    name: "Bill No. 1",
    label: "Bill No. 1",
    firstBodyRow: 1,
    freeColumnStart: 6,
    columns: { "0": "code", "1": "description" },
    bindings: [],
  };
  const scratch: WorkbookSheetLayout = { ...bill, sheetId: "s1", kind: "scratch", name: "Working", label: "Working" };
  const sheetOf = (id: string) => (id === bill.sheetId ? bill : id === scratch.sheetId ? scratch : undefined);
  const onBill = () => bill;

  it("never refuses adding a worksheet, whatever cell is selected", () => {
    // The defect: A1 is the generated code column and is selected on open, so
    // the range-less insert fell back to it and Add sheet did nothing.
    assert.equal(worksheetTargetOf("sheet.command.insert-sheet", { index: 2 }, onBill, sheetOf), null);
    assert.equal(worksheetTargetOf("sheet.command.copy-sheet", {}, onBill, sheetOf), null);
  });

  it("never refuses switching worksheets or reordering the tabs", () => {
    for (const id of [
      "sheet.command.set-worksheet-activate",
      "sheet.command.set-worksheet-order",
      "sheet.command.set-tab-color",
      "sheet.command.set-worksheet-hidden",
    ]) {
      assert.equal(worksheetTargetOf(id, { subUnitId: bill.sheetId }, onBill, sheetOf), null, id);
    }
  });

  it("still refuses removing or renaming a bill's worksheet", () => {
    const removed = worksheetTargetOf("sheet.command.remove-sheet", { subUnitId: bill.sheetId }, onBill, sheetOf);
    assert.equal(removed?.sheet.sheetId, bill.sheetId);
    assert.match(removed!.reason, /cannot be removed/);

    const renamed = worksheetTargetOf(
      "sheet.command.set-worksheet-name",
      { subUnitId: bill.sheetId, name: "Mine" },
      onBill,
      sheetOf,
    );
    assert.match(renamed!.reason, /keeps its name/);
  });

  it("allows removing or renaming a scratch worksheet — it is the user's", () => {
    assert.equal(worksheetTargetOf("sheet.command.remove-sheet", { subUnitId: scratch.sheetId }, onBill, sheetOf), null);
    assert.equal(
      worksheetTargetOf("sheet.command.set-worksheet-name", { subUnitId: scratch.sheetId }, onBill, sheetOf),
      null,
    );
  });

  it("allows a worksheet the layout has never heard of — it was just added", () => {
    assert.equal(worksheetTargetOf("sheet.command.remove-sheet", { subUnitId: "sheet-new" }, onBill, sheetOf), null);
  });

  it("judges by the targeted worksheet, not the one in front", () => {
    // Removing a scratch sheet while a bill is active must not be refused for
    // the bill, and vice versa.
    assert.equal(worksheetTargetOf("sheet.command.remove-sheet", { subUnitId: scratch.sheetId }, onBill, sheetOf), null);
    const fromScratch = worksheetTargetOf(
      "sheet.command.remove-sheet",
      { subUnitId: bill.sheetId },
      () => scratch,
      sheetOf,
    );
    assert.equal(fromScratch?.sheet.sheetId, bill.sheetId);
  });
});
