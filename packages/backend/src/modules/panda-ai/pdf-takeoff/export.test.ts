import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { buildBoqWorkbookBuffer } from "./export.ts";
import { sumRefs, typicalOf } from "./export-formulas.ts";
import { measurementLines } from "./export-measurements.ts";
import { computeSummary } from "./service.ts";
import type { PreconBoqRowDto, PreconSnapshot } from "./types.ts";

function makeSnapshot(): PreconSnapshot {
  const rows = [
    { id: "r1", billId: "b1", sort: 0, rowType: "heading", description: "PRELIMINARIES", elementGroup: null },
    {
      id: "r2",
      billId: "b1",
      sort: 1,
      rowType: "item",
      description: "Contractor's obligations",
      elementGroup: "Preliminaries",
      unit: "item",
      qty: 1,
      rate: 100000,
      amount: 100000,
      status: "verified",
      version: 1,
    },
    { id: "r3", billId: "b2", sort: 2, rowType: "heading", description: "WALLS", elementGroup: "Walls" },
    {
      id: "r4",
      billId: "b2",
      sort: 3,
      rowType: "item",
      code: "F10/125",
      description: "225mm blockwork",
      elementGroup: "Walls",
      unit: "m2",
      qtyGross: 50.2,
      deductions: [{ label: "Door D1", qty: 4, geometryId: null }],
      qty: 46.2,
      rate: 12000,
      amount: 554400,
      status: "verified",
      origin: "manual",
      measurementBasis: "18.6 m polyline on DWG-01 × 2.7 m height = 50.22 m2",
      version: 1,
    },
    {
      id: "r5",
      billId: "b2",
      sort: 4,
      rowType: "item",
      description: "Rejected thing",
      elementGroup: "Walls",
      unit: "m2",
      qty: 10,
      rate: 1000,
      amount: 10000,
      status: "rejected",
      version: 1,
    },
  ].map((r) => ({
    qtyGross: null,
    typical: 1,
    deductions: [],
    qty: null,
    rate: null,
    amount: null,
    rateSource: null,
    confidence: null,
    status: null,
    measurementBasis: null,
    verifiedBy: null,
    verifiedAt: null,
    confidenceReason: null,
    provenance: null,
    origin: "ai",
    editedAt: null,
    editedBy: null,
    code: null,
    unit: null,
    version: 1,
    ...r,
  })) as PreconBoqRowDto[];

  const settings = { prelimsPct: 5, contingencyPct: 5, vatPct: 7.5 };
  return {
    session: {
      id: "pcs_1",
      orgId: "org_1",
      projectId: null,
      proposalId: null,
      status: "reviewing",
      title: "Renovation of Building A",
      error: null,
      phase: null,
      progressLog: [],
      scope: { kind: "full", elements: [] },
      planId: null,
      takeoffKind: "pdf",
      extraction: null,
      structureContext: null,
      revision: 1,
      supersededBy: null,
      createdBy: "u_1",
      createdAt: "2026-07-12T00:00:00.000Z",
    },
    sheets: [
      {
        id: "sh_1",
        sessionId: "pcs_1",
        fileName: "plan.dwg",
        pageNumber: 1,
        code: "DWG-01",
        title: "Ground floor",
        kind: "floor-plan",
        status: "measured",
        scaleMmPerPt: 17.64,
        scaleConfidence: 1,
        dimUnit: "mm",
        geoSummary: null,
        bounds: null,
        viewports: [],
        error: null,
      },
    ],
    bills: [
      { id: "b1", title: "Bill No. 1 - Preliminaries", sort: 0 },
      { id: "b2", title: "Bill No. 2 - Measured works", sort: 1 },
    ],
    rows,
    geometries: [{ id: "g1", rowId: "r4", sheetId: "sh_1", kind: "linear", vertices: [[0, 0], [10, 0]], source: "manual", quantity: 18.6, unit: "m" }],
    settings,
    summary: computeSummary(rows, settings),
    progress: { total: 3, verified: 2 },
  };
}

const AMOUNT = 8; // column I, zero-based

test("export: workbook reconciles with snapshot totals, drops rejected rows", async () => {
  const snapshot = makeSnapshot();
  const buffer = await buildBoqWorkbookBuffer(snapshot, "Test Project");
  const reparsed = XLSX.read(buffer, { type: "buffer" });
  assert.deepEqual(reparsed.SheetNames.slice(0, 1), ["Cover Page"]);
  assert.ok(reparsed.SheetNames.includes("General Summary"));
  assert.deepEqual(reparsed.SheetNames.slice(-1), ["Measurements"]);
  assert.equal(reparsed.SheetNames.length, 5); // cover + 2 bills + summary + measurements

  // bill sheet: rejected row absent, letters restart, cached total matches
  const bill2 = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    reparsed.Sheets[reparsed.SheetNames[2]!]!,
    { header: 1, defval: null },
  ) as unknown as (string | number | null)[][];
  const flat = bill2.flat().filter((c) => c !== null);
  assert.ok(flat.includes("225mm blockwork"));
  assert.ok(!flat.includes("Rejected thing"));
  const billTotalRow = bill2.find((r) => typeof r[1] === "string" && (r[1] as string).includes("TOTAL"));
  assert.ok(billTotalRow);
  assert.equal(billTotalRow![AMOUNT], 554400);

  // general summary reconciles with computeSummary
  const summarySheet = XLSX.utils.sheet_to_json<(string | number | null)[]>(
    reparsed.Sheets["General Summary"]!,
    { header: 1, defval: null },
  ) as (string | number | null)[][];
  const grand = summarySheet.find((r) => r[1] === "GRAND TOTAL");
  assert.ok(grand);
  assert.equal(grand![AMOUNT], snapshot.summary.grandTotal);
  const vatRow = summarySheet.find((r) => typeof r[1] === "string" && (r[1] as string).startsWith("ADD VAT"));
  assert.equal(vatRow![AMOUNT], snapshot.summary.vat);

  // presentation: header row bold, grand total bold with double bottom border
  const styled = new ExcelJS.Workbook();
  await styled.xlsx.load(buffer as never);
  const summaryWs = styled.getWorksheet("General Summary")!;
  assert.equal(summaryWs.getRow(1).font?.bold, true);
  const grandRows: ExcelJS.Row[] = [];
  summaryWs.eachRow((row) => {
    if (row.getCell(2).value === "GRAND TOTAL") grandRows.push(row);
  });
  assert.equal(grandRows.length, 1, "grand total row present");
  assert.equal(grandRows[0]!.font?.bold, true);
  assert.equal(grandRows[0]!.getCell(9).border?.bottom?.style, "double");
});

test("export: quantities, amounts, subtotals and the summary are live formulas, not values", async () => {
  const snapshot = makeSnapshot();
  const buffer = await buildBoqWorkbookBuffer(snapshot, "Test Project");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);

  const bill2 = wb.getWorksheet("Bill No. 2 - Measured works")!;
  const item = findRow(bill2, (v) => v === "225mm blockwork");
  assert.equal(item.getCell(3).value, 50.2, "gross is a value");
  assert.equal(item.getCell(4).value, 4, "deductions are a value");
  assert.equal(item.getCell(5).value, 1, "typical defaults to 1");
  const n = item.number;
  assert.equal(formulaOf(item.getCell(6)), `(C${n}-D${n})*E${n}`);
  assert.equal(formulaOf(item.getCell(9)), `F${n}*H${n}`);
  assert.equal(resultOf(item.getCell(6)), 46.2, "cached net is the app's quantity");

  const subtotal = findRow(bill2, (v) => typeof v === "string" && v.includes("CARRIED TO SUMMARY"));
  assert.equal(formulaOf(subtotal.getCell(9)), `SUM(I${n})`);
  const total = findRow(bill2, (v) => typeof v === "string" && v.endsWith("— TOTAL"));
  assert.match(formulaOf(total.getCell(9)), /^SUM\(I\d+\)$/);

  const summary = wb.getWorksheet("General Summary")!;
  const bill2Line = findRow(summary, (v) => v === "Bill No. 2 - Measured works");
  assert.equal(formulaOf(bill2Line.getCell(9)), `'Bill No. 2 - Measured works'!I${total.number}`);
  const prelims = findRow(summary, (v) => typeof v === "string" && v.startsWith("PRELIMINARIES"));
  assert.match(formulaOf(prelims.getCell(9)), /^ROUND\(SUM\(I\d+:I\d+\)\*5\/100,2\)$/);
  const grand = findRow(summary, (v) => v === "GRAND TOTAL");
  assert.match(formulaOf(grand.getCell(9)), /^I\d+\+I\d+$/);
  assert.equal(resultOf(grand.getCell(9)), snapshot.summary.grandTotal);
});

test("export: the Measurements sheet lists sheet, tool, gross, unit and basis per priced line", async () => {
  const snapshot = makeSnapshot();
  const lines = measurementLines(snapshot);
  assert.deepEqual(
    lines.map((l) => [l.sheet, l.tool, l.gross, l.unit, l.basis]),
    [
      ["—", "stated", 1, "item", ""],
      ["DWG-01", "wall area", 50.2, "m2", "18.6 m polyline on DWG-01 × 2.7 m height = 50.22 m2"],
    ],
  );
  const buffer = await buildBoqWorkbookBuffer(snapshot, "Test Project");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);
  const ws = wb.getWorksheet("Measurements")!;
  // ExcelJS row values are 1-indexed: slot 0 is always empty
  assert.deepEqual((ws.getRow(1).values as ExcelJS.CellValue[]).slice(1), ["SHEET", "BILL", "CODE", "DESCRIPTION", "TOOL", "GROSS", "UNIT", "BASIS", "ORIGIN", "STATUS"]);
  assert.equal(ws.getRow(3).getCell(1).value, "DWG-01");
  assert.equal(ws.getRow(3).getCell(3).value, "F10/125");
});

test("export helpers: sumRefs folds runs, typical reads the column when present", () => {
  assert.equal(sumRefs(9, []), "0");
  assert.equal(sumRefs(9, [5]), "SUM(I5)");
  assert.equal(sumRefs(9, [5, 6, 7, 9, 12, 13]), "SUM(I5:I7,I9,I12:I13)");
  const base = { deductions: [] } as unknown as PreconBoqRowDto;
  assert.equal(typicalOf(base), 1);
  assert.equal(typicalOf({ ...base, typical: 4 } as PreconBoqRowDto), 4);
  assert.equal(typicalOf({ ...base, typical: "3" } as unknown as PreconBoqRowDto), 3);
});

function findRow(ws: ExcelJS.Worksheet, match: (description: ExcelJS.CellValue) => boolean): ExcelJS.Row {
  let found: ExcelJS.Row | undefined;
  ws.eachRow((row) => {
    if (!found && match(row.getCell(2).value)) found = row;
  });
  assert.ok(found, "row present");
  return found!;
}

function formulaOf(cell: ExcelJS.Cell): string {
  const value = cell.value as { formula?: string } | null;
  assert.ok(value && typeof value === "object" && value.formula, `${cell.address} carries a formula`);
  return value.formula!;
}

function resultOf(cell: ExcelJS.Cell): unknown {
  return (cell.value as { result?: unknown }).result;
}
