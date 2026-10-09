// Worksheet names Excel can hold, and the refusals that keep an export honest.
//
// Pure: no database, no worker, no engine. The sibling suite proves these rules
// hold in a real downloaded file; this one covers the cases that are awkward to
// stage through one — an apostrophe inside a worksheet name, a name that only
// appears inside a string literal, a document too big to send.
//
// The re-pointing tests matter more than they look. Renaming a worksheet
// without rewriting the formulas that name it turns a priced bill into a bill
// full of `#REF!`, and rewriting too eagerly corrupts a description that merely
// mentions the sheet. Both are silent.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isWorkbookRejection } from "./engine-errors.ts";
import { validateWorkbookSnapshot } from "./engine-validation.ts";
import { buildWorkbookXlsx } from "./export-xlsx.ts";
import { excelSheetNames, rewriteSheetRefs } from "./export-names.ts";
import type { WorkbookCellMatrix, WorkbookSnapshot } from "./engine-types.ts";
import type { WorkbookDocument } from "./types.ts";

const meta = () => ({ projectName: null, sessionTitle: "t", generatedAt: new Date("2026-03-01T09:00:00Z") });

const snapshotNamed = (...names: string[]): WorkbookSnapshot => ({
  id: "wb",
  name: "wb",
  sheetOrder: names.map((_, index) => `s${index}`),
  sheets: Object.fromEntries(
    names.map((name, index) => [`s${index}`, { id: `s${index}`, name, rowCount: 1, columnCount: 1, cellData: {} }]),
  ),
  styles: {},
});

function documentWith(cellData: WorkbookCellMatrix, values: WorkbookDocument["values"] = {}): WorkbookDocument {
  return {
    sessionId: "session-1",
    version: 1,
    engineVersion: "univer-oss-1.0.0",
    snapshot: {
      id: "wb",
      name: "wb",
      sheetOrder: ["s1"],
      sheets: { s1: { id: "s1", name: "S1", rowCount: 1000, columnCount: 100, cellData } },
      styles: {},
    },
    layout: { schemaVersion: 1, sheets: [] },
    values,
    errors: [],
    sourceFingerprint: "f",
    reviewRollup: {
      boundRows: 0,
      verified: 0,
      needsReview: 0,
      unreviewed: 0,
      withdrawn: 0,
      missingBasis: 0,
      stated: 0,
      sourcesMoved: false,
    },
    updatedAt: null,
    updatedBy: null,
    history: [],
  };
}

const withFormula = (formula: string): WorkbookDocument =>
  documentWith({ "0": { "0": { f: formula } } }, { s1: { "0": { "0": { value: 1234, formula } } } });

describe("re-pointing a renamed worksheet touches formulas and nothing else", () => {
  const renamed = new Map([["rates 1:5", "Rates 1 5"]]);

  it("leaves a formula alone when no worksheet moved", () => {
    assert.equal(rewriteSheetRefs("=SUM('Rates 1:5'!A1:A9)", new Map()), "=SUM('Rates 1:5'!A1:A9)");
  });

  it("re-points a quoted reference", () => {
    assert.equal(rewriteSheetRefs("=SUM('Rates 1:5'!A1:A9)", renamed), "=SUM('Rates 1 5'!A1:A9)");
  });

  it("re-points a bare reference and quotes the result when the new name needs it", () => {
    assert.equal(rewriteSheetRefs("=Scratch!A1", new Map([["scratch", "Scratch copy"]])), "='Scratch copy'!A1");
  });

  it("does NOT touch a worksheet name that only appears inside a string", () => {
    assert.equal(
      rewriteSheetRefs('=IF(A1="see \'Rates 1:5\'! for the build-up",1,0)', renamed),
      '=IF(A1="see \'Rates 1:5\'! for the build-up",1,0)',
    );
  });

  it("keeps a doubled apostrophe inside a name it re-points", () => {
    assert.equal(
      rewriteSheetRefs("='Bob''s rates'!B2", new Map([["bob's rates", "Bob's new rates"]])),
      "='Bob''s new rates'!B2",
    );
  });

  it("leaves a cell reference that merely follows a bang alone", () => {
    assert.equal(rewriteSheetRefs("='Rates 1:5'!AB12+AB13", renamed), "='Rates 1 5'!AB12+AB13");
  });
});

describe("worksheet names are made legal without colliding", () => {
  it("strips the characters Excel forbids", () => {
    assert.equal(excelSheetNames(snapshotNamed("Rates 1:5 */ working")).byId.get("s0"), "Rates 1 5 working");
  });

  it("suffixes rather than collides when two names clean to the same thing", () => {
    const names = excelSheetNames(snapshotNamed("Rates:1", "Rates?1"));
    assert.equal(names.byId.get("s0"), "Rates 1");
    assert.equal(names.byId.get("s1"), "Rates 1 (2)");
  });

  it("moves a worksheet off Excel's reserved History name", () => {
    assert.equal(excelSheetNames(snapshotNamed("History")).byId.get("s0"), "History (2)");
  });

  it("records only the worksheets that actually moved", () => {
    const names = excelSheetNames(snapshotNamed("Summary", "Rates:1"));
    assert.equal(names.renamed.has("summary"), false);
    assert.equal(names.renamed.get("rates:1"), "Rates 1");
  });
});

describe("refusals are by name, never a quietly exported number", () => {
  it("refuses a formula Excel could not reproduce rather than exporting its last number", async () => {
    await assert.rejects(
      () => buildWorkbookXlsx(withFormula("=NOW()"), meta()),
      (error: unknown) => isWorkbookRejection(error, "unsupported_formula"),
    );
  });

  it("refuses a reference to another workbook", async () => {
    await assert.rejects(
      () => buildWorkbookXlsx(withFormula("=[Book2.xlsx]Sheet1!A1"), meta()),
      (error: unknown) => isWorkbookRejection(error, "unsupported_formula"),
    );
  });

  it("refuses a document with more cells than one download may carry", async () => {
    const cellData: Record<string, Record<string, { v: number; t: 2 }>> = {};
    for (let row = 0; row < 220; row += 1) {
      const line: Record<string, { v: number; t: 2 }> = {};
      for (let column = 0; column < 50; column += 1) line[String(column)] = { v: row + column, t: 2 };
      cellData[String(row)] = line;
    }
    await assert.rejects(
      () => buildWorkbookXlsx(documentWith(cellData), meta()),
      (error: unknown) => isWorkbookRejection(error, "too_large"),
    );
  });
});

describe("a formula's worth is the engine's to decide, never the client's", () => {
  it("drops a value stored beside a formula, so the cell cannot be pinned", () => {
    const stored = validateWorkbookSnapshot({
      id: "wb",
      name: "wb",
      sheetOrder: ["s1"],
      styles: {},
      sheets: {
        s1: {
          id: "s1",
          name: "S1",
          rowCount: 4,
          columnCount: 4,
          cellData: { "0": { "0": { v: 5, t: 2 }, "1": { f: "=A1*2", v: 999, t: 2 } } },
        },
      },
    });
    assert.deepEqual(stored.sheets["s1"]!.cellData["0"]!["1"], { f: "=A1*2", t: 2 });
    assert.deepEqual(stored.sheets["s1"]!.cellData["0"]!["0"], { v: 5, t: 2 }, "a literal keeps its value");
  });
});
