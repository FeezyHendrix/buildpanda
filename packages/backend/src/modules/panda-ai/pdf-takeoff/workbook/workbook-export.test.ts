// What actually lands in the .xlsx a QS downloads.
//
// Every assertion here reads a REAL ExcelJS-parsed file built from a REAL
// Univer calculation — nothing is checked against an intermediate structure,
// because the whole class of bug this suite exists for lives in the last step:
// a figure that was right in the document and wrong, missing or silently zero
// by the time it reached the spreadsheet.
//
// The fixture is deliberately hostile (see `workbook-export-fixtures.ts`): the
// workbook was SAVED when the bill said 44, and is exported after a remeasure
// moved it to 52. A stored snapshot carrying the old figures is exactly what a
// stale export would quote, so the suite fails loudly if 44 or 220000 appears
// anywhere a live figure belongs.
//
// The name-legalisation machinery and the export's refusals are pure and live
// in `workbook-export-names.test.ts`.

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import ExcelJS from "exceljs";
import { composeWorkbook, liveRowsById } from "./document.ts";
import { buildWorkbookXlsx } from "./export-xlsx.ts";
import { afterRemeasure, asSaved, storedAt, TRUNCATED_SCRATCH_NAME } from "./workbook-export-fixtures.ts";
import type { WorkbookDocument } from "./types.ts";

let document: WorkbookDocument;
let file: ExcelJS.Workbook;

before(async () => {
  const stored = storedAt(asSaved());
  const source = afterRemeasure();
  const composed = await composeWorkbook({
    source,
    stored,
    user: null,
    rows: liveRowsById(source),
    version: stored.version,
    history: [],
  });
  document = composed.document;

  const buffer = await buildWorkbookXlsx(document, {
    projectName: "Ikoyi Residences",
    sessionTitle: "Ground floor take-off",
    generatedAt: new Date("2026-03-01T09:00:00Z"),
  });
  file = new ExcelJS.Workbook();
  await file.xlsx.load(buffer);
});

const bill = (): ExcelJS.Worksheet => file.getWorksheet("Bill No. 1")!;
const summary = (): ExcelJS.Worksheet => file.getWorksheet("Summary")!;
const scratch = (): ExcelJS.Worksheet => file.getWorksheet(TRUNCATED_SCRATCH_NAME)!;

const formulaOf = (cell: ExcelJS.Cell): string => (cell.value as ExcelJS.CellFormulaValue).formula;
const resultOf = (cell: ExcelJS.Cell): unknown => (cell.value as ExcelJS.CellFormulaValue).result;

describe("the exported file quotes the bill as it stands now", () => {
  it("carries the remeasured quantity and amount, not the ones it was saved with", () => {
    assert.equal(bill().getCell("D2").value, 52);
    assert.equal(bill().getCell("F2").value, 260000);
  });

  it("never lets the stored snapshot's superseded figures through", () => {
    const written = bill().getRow(2).values as unknown[];
    assert.ok(!written.includes(44), "the pre-remeasure quantity reached the file");
    assert.ok(!written.includes(220000), "the pre-remeasure amount reached the file");
  });

  it("leaves the untouched line exactly where it was", () => {
    assert.equal(bill().getCell("D3").value, 120);
    assert.equal(bill().getCell("F3").value, 144000);
  });
});

describe("formulas survive as formulas", () => {
  it("keeps a free-column formula's text and gives it this read's result", () => {
    const cell = bill().getCell("G2");
    assert.equal(formulaOf(cell), "D2*2");
    assert.equal(resultOf(cell), 104, "2 x the remeasured 52");
    assert.notEqual(resultOf(cell), 88, "the value the client had stored beside the formula was exported");
  });

  it("keeps a cross-sheet formula on a scratch worksheet", () => {
    const cell = scratch().getCell("B1");
    assert.equal(formulaOf(cell), "SUM('Bill No. 1'!F2:F3)");
    assert.equal(resultOf(cell), 404000);
  });

  it("keeps a formula that depends on another scratch cell", () => {
    assert.equal(formulaOf(scratch().getCell("B2")), "ROUND(B1*0.1,2)");
    assert.equal(resultOf(scratch().getCell("B2")), 40400);
  });

  it("gives the generated bill total a live SUM that skips the withdrawn slot", () => {
    const cell = summary().getCell("B3");
    assert.match(formulaOf(cell), /^SUM\('Bill No\. 1'!F2:F3,'Bill No\. 1'!F5:F5\)$/);
    assert.equal(resultOf(cell), 404000);
  });
});

describe("an absent figure stays absent and an error stays an error", () => {
  it("exports a withdrawn line as a real Excel #REF!, never as 0", () => {
    const cell = bill().getCell("D4");
    assert.equal(formulaOf(cell), "#REF!");
    assert.deepEqual(resultOf(cell), { error: "#REF!" });
    assert.notEqual(resultOf(cell), 0);
  });

  it("exports an unrated line with a blank rate and amount, not 0 and not false", () => {
    assert.equal(bill().getCell("E5").value, null);
    assert.equal(bill().getCell("F5").value, null);
    assert.equal(bill().getCell("E5").type, ExcelJS.ValueType.Null);
  });

  it("exports an emptied-but-formatted cell blank, so nothing reads as a nil price", () => {
    const cell = scratch().getCell("B3");
    assert.equal(cell.value, null);
    assert.equal(cell.type, ExcelJS.ValueType.Null);
    assert.equal(scratch().getCell("A3").value, "Contingency (not yet agreed)", "the cell really is on the sheet");
  });

  it("reports the error cells rather than hiding them", () => {
    assert.ok(document.errors.length > 0);
    assert.equal(document.errors.every((error) => error.code === "#REF!"), true);
  });
});

describe("worksheet names Excel can hold, with references that still resolve", () => {
  it("truncates a name Excel would refuse", () => {
    assert.equal(scratch().name.length <= 31, true);
    assert.equal(scratch().name, TRUNCATED_SCRATCH_NAME);
  });

  it("re-points a formula that named the worksheet before it was truncated", () => {
    const cell = summary().getCell("C1");
    assert.equal(formulaOf(cell), `'${TRUNCATED_SCRATCH_NAME}'!B1`);
    assert.equal(resultOf(cell), 404000);
  });

  it("gives every worksheet a distinct name", () => {
    const names = file.worksheets.map((sheet) => sheet.name.toLowerCase());
    assert.equal(new Set(names).size, names.length);
  });
});

describe("the file says what it is", () => {
  it("carries the take-off, the version and the fingerprint it was calculated against", () => {
    const text = file.worksheets[0]!
      .getSheetValues()
      .flatMap((row) => (Array.isArray(row) ? row : []))
      .map((value) => String(value ?? ""))
      .join("\n");
    assert.match(text, /Ground floor take-off/);
    assert.match(text, new RegExp(document.sourceFingerprint));
    assert.match(text, /must not be read as zero/);
  });

  // `fullCalcOnLoad` is deliberately NOT asserted. ExcelJS writes it
  // (`<calcPr fullCalcOnLoad="1"/>`) but its reader drops `calcProperties`
  // entirely, so a round-trip cannot see it, and reaching into the zip would
  // mean importing jszip — a hoisted transitive of exceljs, not a declared
  // dependency of this package. A test that cannot distinguish the behaviour
  // it names is worse than no test.
  it("opens on the provenance, so nobody reads a figure before what it is true of", () => {
    assert.equal(file.worksheets[0]?.name, "Workbook details");
  });
});

describe("the formatting a person applied comes with it", () => {
  it("carries bold, alignment and the number format", () => {
    const cell = bill().getCell("G2");
    assert.equal(cell.font?.bold, true);
    assert.equal(cell.alignment?.horizontal, "right");
    assert.equal(cell.numFmt, "#,##0.00");
  });
});
