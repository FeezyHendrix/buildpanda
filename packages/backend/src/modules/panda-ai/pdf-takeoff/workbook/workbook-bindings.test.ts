// Does a worksheet slot still mean the same bill line tomorrow?
//
// Everything a QS writes in the free columns points at a slot by address:
// `=D3*2` means "twice whatever is in row 3". If row 3 ever comes to mean a
// different bill line, that formula silently prices the wrong work — no error,
// no warning, a wrong number on a tender. So these tests are about ONE
// property: a slot, once issued, is never reissued and never moves.
//
// They are pure: no database, no worker, no HTTP. The live round-trip proves
// the wiring; this proves the arithmetic of identity, including the cases that
// are awkward to stage against a real server.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGeneratedLayout, billSheetIdFor, safeSheetName, SUMMARY_SHEET_ID } from "./layout.ts";
import { sourceFingerprint } from "./fingerprint.ts";
import { liveRowsById, reviewRollup } from "./document.ts";
import { withScratchSheets } from "./layout.ts";
import {
  sourceBill,
  sourceGeometry,
  sourceRow,
  takeoffSource,
} from "./workbook-source-fixtures.ts";
import type { WorkbookLayout } from "./types.ts";

const layoutOf = (sheets: ReturnType<typeof buildGeneratedLayout>): WorkbookLayout => ({
  schemaVersion: 1,
  sheets,
});

const billSheet = (layout: WorkbookLayout, billId = "bill-1") =>
  layout.sheets.find((sheet) => sheet.sheetId === billSheetIdFor(billId))!;

const slotOf = (layout: WorkbookLayout, rowId: string): number | undefined =>
  billSheet(layout).bindings.find((binding) => binding.rowId === rowId)?.gridRow;

describe("workbook slots are permanent", () => {
  it("gives each bill line its own row, in bill order, below the heading row", () => {
    const layout = layoutOf(buildGeneratedLayout(takeoffSource()));
    assert.equal(slotOf(layout, "row-a"), 1);
    assert.equal(slotOf(layout, "row-b"), 2);
  });

  it("keeps a withdrawn line's slot and does NOT slide the line below it up", () => {
    const first = layoutOf(buildGeneratedLayout(takeoffSource()));
    const withdrawn = takeoffSource({
      rows: [
        sourceRow({ id: "row-a", sort: 0, withdrawn: true }),
        sourceRow({ id: "row-b", sort: 1 }),
      ],
    });
    const second = layoutOf(buildGeneratedLayout(withdrawn, first));

    assert.equal(slotOf(second, "row-a"), 1, "the withdrawn line keeps its own row");
    assert.equal(slotOf(second, "row-b"), slotOf(first, "row-b"), "the line below did not move");
    assert.equal(billSheet(second).bindings.find((b) => b.rowId === "row-a")?.state, "withdrawn");
  });

  it("never reissues a withdrawn line's slot to a new line", () => {
    const first = layoutOf(buildGeneratedLayout(takeoffSource()));
    const after = takeoffSource({
      rows: [
        sourceRow({ id: "row-a", sort: 0, withdrawn: true }),
        sourceRow({ id: "row-b", sort: 1 }),
        sourceRow({ id: "row-c", sort: 2 }),
      ],
    });
    const second = layoutOf(buildGeneratedLayout(after, first));

    assert.equal(slotOf(second, "row-c"), 3, "the new line appended below everything ever issued");
    assert.notEqual(slotOf(second, "row-c"), slotOf(first, "row-a"));
  });

  it("keeps slots stable even when the bill is re-sorted underneath", () => {
    const first = layoutOf(buildGeneratedLayout(takeoffSource()));
    const resorted = takeoffSource({
      rows: [sourceRow({ id: "row-b", sort: 0 }), sourceRow({ id: "row-a", sort: 1 })],
    });
    const second = layoutOf(buildGeneratedLayout(resorted, first));

    assert.equal(slotOf(second, "row-a"), slotOf(first, "row-a"));
    assert.equal(slotOf(second, "row-b"), slotOf(first, "row-b"));
  });

  it("gives a re-added line that was hard-deleted a NEW slot, not the old one", () => {
    const first = layoutOf(buildGeneratedLayout(takeoffSource()));
    const gone = takeoffSource({ rows: [sourceRow({ id: "row-b", sort: 1 })] });
    const second = layoutOf(buildGeneratedLayout(gone, first));
    assert.equal(billSheet(second).bindings.find((b) => b.rowId === "row-a")?.state, "withdrawn");
    assert.equal(slotOf(second, "row-a"), 1, "the vanished line's slot is held as a tombstone");
  });
});

describe("a generated worksheet's name survives a rename", () => {
  it("pins the worksheet name and moves only the label when a bill is retitled", () => {
    const first = layoutOf(buildGeneratedLayout(takeoffSource()));
    const original = billSheet(first).name;
    assert.equal(original, "Bill No. 1");

    const renamed = takeoffSource({ bills: [sourceBill("bill-1", "Ground Floor Works")] });
    const second = layoutOf(buildGeneratedLayout(renamed, first));

    assert.equal(billSheet(second).name, original, "=SUM('Bill No. 1'!...) must not become a #REF!");
    assert.equal(billSheet(second).label, "Ground Floor Works", "the UI still shows the current title");
  });

  it("strips the characters a cross-sheet reference cannot spell, and caps the length", () => {
    assert.equal(safeSheetName("Bill [A]: works/units?", "fallback"), "Bill A works units");
    assert.equal(safeSheetName("", "fallback"), "fallback");
    assert.equal(safeSheetName("x".repeat(60), "fallback").length, 31);
  });

  it("does not let two bills claim one worksheet name", () => {
    const layout = layoutOf(
      buildGeneratedLayout(
        takeoffSource({ bills: [sourceBill("bill-1", "Bill"), sourceBill("bill-2", "Bill", 1)] }),
      ),
    );
    const names = layout.sheets.map((sheet) => sheet.name);
    assert.equal(new Set(names).size, names.length);
  });
});

describe("bill slots on the summary worksheet", () => {
  it("keeps a removed bill's row and appends a new bill below it", () => {
    const first = layoutOf(buildGeneratedLayout(takeoffSource()));
    const summaryOf = (l: WorkbookLayout) => l.sheets.find((s) => s.sheetId === SUMMARY_SHEET_ID)!;
    assert.equal(summaryOf(first).billSlots?.[0]?.gridRow, 2);

    const swapped = takeoffSource({ bills: [sourceBill("bill-2", "Bill No. 2", 1)] });
    const second = layoutOf(buildGeneratedLayout(swapped, first));
    const slots = summaryOf(second).billSlots ?? [];
    assert.equal(slots.find((s) => s.billId === "bill-1")?.state, "withdrawn");
    assert.equal(slots.find((s) => s.billId === "bill-1")?.gridRow, 2);
    assert.equal(slots.find((s) => s.billId === "bill-2")?.gridRow, 3);
  });
});

describe("how a figure came to be decides what the UI may offer", () => {
  const basisOfRow = (source: ReturnType<typeof takeoffSource>, rowId: string) =>
    billSheet(layoutOf(buildGeneratedLayout(source))).bindings.find((b) => b.rowId === rowId);

  it("calls a drawn line with a recorded measurement 'measured', and offers a remeasure", () => {
    const binding = basisOfRow(takeoffSource(), "row-a");
    assert.equal(binding?.basis, "measured");
    assert.equal(binding?.remeasurable, true);
    assert.deepEqual(binding?.geometryIds, ["geo-a"]);
  });

  it("calls a drawn line with NO recorded measurement 'legacy', and refuses to offer a remeasure", () => {
    const source = takeoffSource({ geometries: [sourceGeometry("geo-a", "row-a", false)] });
    const binding = basisOfRow(source, "row-a");
    assert.equal(binding?.basis, "legacy");
    assert.equal(binding?.remeasurable, false, "there is nothing to reopen; basis confirmation is the path");
  });

  it("calls a priced line with no annotation 'stated', so the UI offers Draw and never invents one", () => {
    const binding = basisOfRow(takeoffSource({ geometries: [] }), "row-a");
    assert.equal(binding?.basis, "stated");
    assert.equal(binding?.remeasurable, false);
    assert.deepEqual(binding?.geometryIds, []);
  });

  it("calls a heading 'narrative', and keeps it out of the review counts", () => {
    const source = takeoffSource({
      rows: [sourceRow({ id: "head", sort: 0, rowType: "heading" }), sourceRow({ id: "row-a", sort: 1 })],
      geometries: [],
    });
    const layout = layoutOf(buildGeneratedLayout(source));
    assert.equal(basisOfRow(source, "head")?.basis, "narrative");
    assert.equal(reviewRollup(layout, liveRowsById(source), false).boundRows, 1);
  });
});

describe("the source fingerprint moves whenever a dependency does", () => {
  const base = takeoffSource();

  it("agrees with itself", () => {
    assert.equal(sourceFingerprint(base), sourceFingerprint(takeoffSource()));
  });

  it("does not care how a decimal was spelled", () => {
    const a = takeoffSource({ rows: [sourceRow({ id: "row-a", sort: 0, qty: "44.00" })] });
    const b = takeoffSource({ rows: [sourceRow({ id: "row-a", sort: 0, qty: "44.0" })] });
    assert.equal(sourceFingerprint(a), sourceFingerprint(b), "2.70 and 2.7 are the same quantity");
  });

  it("moves when a quantity moves", () => {
    const after = takeoffSource({ rows: [sourceRow({ id: "row-a", sort: 0, qty: "52.00" })] });
    assert.notEqual(sourceFingerprint(base), sourceFingerprint(after));
  });

  it("moves when a line is WITHDRAWN, even though no figure changed", () => {
    const after = takeoffSource({
      rows: [sourceRow({ id: "row-a", sort: 0, qty: "44.00", rate: "5000.00", amount: "220000.00", withdrawn: true }),
             sourceRow({ id: "row-b", sort: 1, qty: "120.00", rate: "1200.00", amount: "144000.00" })],
    });
    assert.notEqual(sourceFingerprint(base), sourceFingerprint(after));
  });

  it("moves when the last annotation behind a figure is withdrawn", () => {
    assert.notEqual(sourceFingerprint(base), sourceFingerprint(takeoffSource({ geometries: [] })));
  });

  it("moves when a row's version moves even if every value is identical", () => {
    const after = takeoffSource({
      rows: [sourceRow({ id: "row-a", sort: 0, qty: "44.00", rate: "5000.00", amount: "220000.00", version: 2 }),
             sourceRow({ id: "row-b", sort: 1, qty: "120.00", rate: "1200.00", amount: "144000.00" })],
    });
    assert.notEqual(sourceFingerprint(base), sourceFingerprint(after));
  });
});

describe("worksheets the user owns", () => {
  it("classifies anything the server did not generate as scratch, in the user's tab order", () => {
    const generated = buildGeneratedLayout(takeoffSource());
    const layout = withScratchSheets(
      generated,
      ["scratch-1", SUMMARY_SHEET_ID, billSheetIdFor("bill-1")],
      () => "Working",
    );
    assert.equal(layout.sheets[0]?.sheetId, "scratch-1", "tab order is the user's");
    assert.equal(layout.sheets[0]?.kind, "scratch");
    assert.equal(layout.sheets[0]?.freeColumnStart, 0, "every column of a scratch sheet is theirs");
    assert.equal(layout.sheets.length, 3);
  });

  it("still lists a generated worksheet the document forgot, so a read is never half a bill", () => {
    const generated = buildGeneratedLayout(takeoffSource());
    const layout = withScratchSheets(generated, ["scratch-1"], () => "Working");
    assert.ok(layout.sheets.some((sheet) => sheet.sheetId === billSheetIdFor("bill-1")));
  });
});
