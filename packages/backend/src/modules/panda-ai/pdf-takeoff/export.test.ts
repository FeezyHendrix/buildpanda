import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { buildBoqWorkbookBuffer } from "./export.ts";
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
      qty: 46.2,
      rate: 12000,
      amount: 554400,
      status: "verified",
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
      structureContext: null,
      createdBy: "u_1",
      createdAt: "2026-07-12T00:00:00.000Z",
    },
    sheets: [],
    bills: [
      { id: "b1", title: "Bill No. 1 - Preliminaries", sort: 0 },
      { id: "b2", title: "Bill No. 2 - Measured works", sort: 1 },
    ],
    rows,
    geometries: [],
    settings,
    summary: computeSummary(rows, settings),
    progress: { total: 3, verified: 2 },
  };
}

test("export: workbook reconciles with snapshot totals, drops rejected rows", async () => {
  const snapshot = makeSnapshot();
  const buffer = await buildBoqWorkbookBuffer(snapshot, "Test Project");
  const reparsed = XLSX.read(buffer, { type: "buffer" });
  assert.deepEqual(reparsed.SheetNames.slice(0, 1), ["Cover Page"]);
  assert.ok(reparsed.SheetNames.includes("General Summary"));
  assert.equal(reparsed.SheetNames.length, 4); // cover + 2 bills + summary

  // bill sheet: rejected row absent, letters restart, total matches
  const bill2 = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    reparsed.Sheets[reparsed.SheetNames[2]!]!,
    { header: 1, defval: null },
  ) as unknown as (string | number | null)[][];
  const flat = bill2.flat().filter((c) => c !== null);
  assert.ok(flat.includes("225mm blockwork"));
  assert.ok(!flat.includes("Rejected thing"));
  const billTotalRow = bill2.find((r) => typeof r[1] === "string" && (r[1] as string).includes("TOTAL"));
  assert.ok(billTotalRow);
  assert.equal(billTotalRow![5], 554400);

  // general summary reconciles with computeSummary
  const summarySheet = XLSX.utils.sheet_to_json<(string | number | null)[]>(
    reparsed.Sheets["General Summary"]!,
    { header: 1, defval: null },
  ) as (string | number | null)[][];
  const grand = summarySheet.find((r) => r[1] === "GRAND TOTAL");
  assert.ok(grand);
  assert.equal(grand![5], snapshot.summary.grandTotal);
  const vatRow = summarySheet.find((r) => typeof r[1] === "string" && (r[1] as string).startsWith("ADD VAT"));
  assert.equal(vatRow![5], snapshot.summary.vat);

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
  assert.equal(grandRows[0]!.getCell(6).border?.bottom?.style, "double");
});
