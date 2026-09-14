import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTakeoffCsv, csvField, csvFileName } from "./export-csv.ts";
import type { PreconBoqRowDto, PreconSnapshot } from "./types.ts";

function row(overrides: Partial<PreconBoqRowDto>): PreconBoqRowDto {
  return {
    id: "r",
    billId: "b1",
    sort: 0,
    rowType: "item",
    elementGroup: null,
    code: null,
    description: "",
    unit: null,
    qtyGross: null,
    typical: 1,
    deductions: [],
    qty: null,
    rate: null,
    amount: null,
    rateSource: null,
    confidence: null,
    status: null,
    version: 1,
    measurementBasis: null,
    confidenceReason: null,
    provenance: null,
    origin: "ai",
    editedAt: null,
    editedBy: null,
    verifiedBy: null,
    verifiedAt: null,
    ...overrides,
  };
}

function snapshot(): PreconSnapshot {
  return {
    session: { id: "pcs_1", title: "Ogudu Villa / Rev B" } as PreconSnapshot["session"],
    sheets: [{ id: "sh1", code: "DWG-01", title: null, fileName: "plan.dwg" }, { id: "sh2", code: null, title: "First floor", fileName: "plan.pdf" }] as PreconSnapshot["sheets"],
    bills: [
      { id: "b1", title: "Bill No. 1 — Measured by hand", sort: 0 },
      { id: "b2", title: "Bill No. 2", sort: 1 },
    ],
    rows: [
      row({ id: "h", billId: "b1", sort: 0, rowType: "heading", description: "WALLS" }),
      row({ id: "ws", billId: "b1", sort: 1, rowType: "work_section", description: "F10 Brick/block walling" }),
      row({
        id: "wall",
        billId: "b1",
        sort: 2,
        code: "F10/125",
        description: '225mm blockwork, "hollow", incl. ties',
        elementGroup: "walls",
        unit: "m2",
        qtyGross: 133.92,
        typical: 1,
        deductions: [{ label: "Door D1", qty: 1.89, geometryId: "g2" }, { label: "Window W2", qty: 1.44, geometryId: null }],
        qty: 130.59,
        rate: 12000,
        amount: 1567080,
        status: "verified",
        origin: "manual",
        measurementBasis: "12.4 m polyline on DWG-01 × 2.7 m height × 4 typical floors = 133.92 m2",
      }),
      row({ id: "note", billId: "b1", sort: 3, rowType: "spec_note", description: "Blocks to BS 6073, 3.5 N/mm2", status: null }),
      row({ id: "gone", billId: "b1", sort: 4, description: "Rejected line", qty: 1, status: "rejected" }),
      row({ id: "ps", billId: "b2", sort: 0, rowType: "provisional_sum", description: "Contingency", unit: "item", qtyGross: 1, qty: 1, rate: 500000, amount: 500000, status: "ai_generated" }),
    ],
    geometries: [
      { id: "g1", rowId: "wall", sheetId: "sh1", kind: "linear", vertices: [], source: "manual", quantity: 12.4, unit: "m" },
      { id: "g2", rowId: "wall", sheetId: "sh1", kind: "deduction", vertices: [], source: "manual", quantity: 1.89, unit: "m2" },
      { id: "g3", rowId: "ps", sheetId: "sh2", kind: "area", vertices: [], source: "ai", quantity: 1, unit: "m2" },
    ],
    settings: { prelimsPct: 5, contingencyPct: 5, vatPct: 7.5 },
    summary: { measuredTotal: 0, prelims: 0, constructionSum: 0, contingency: 0, subTotal: 0, vat: 0, grandTotal: 0 },
    progress: { total: 3, verified: 1 },
  };
}

test("csvField quotes per RFC 4180 and leaves plain values alone", () => {
  assert.equal(csvField("plain"), "plain");
  assert.equal(csvField(12.5), "12.5");
  assert.equal(csvField(null), "");
  assert.equal(csvField('a "quoted", value'), '"a ""quoted"", value"');
  assert.equal(csvField("line\nbreak"), '"line\nbreak"');
});

test("buildTakeoffCsv: header, BOM, CRLF, one row per priced line and note, sections carried", () => {
  const csv = buildTakeoffCsv(snapshot());
  assert.ok(csv.startsWith("\uFEFF"), "starts with a UTF-8 BOM");
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines.at(-1), "", "ends with CRLF");
  lines.pop();
  assert.equal(lines[0], "bill,section,code,description,unit,gross,deductions,net,rate,amount,sheet,origin,status,basis");
  // heading, work section and the rejected line are not rows of their own
  assert.equal(lines.length, 4);
  assert.equal(
    lines[1],
    'Bill No. 1 — Measured by hand,F10 Brick/block walling,F10/125,"225mm blockwork, ""hollow"", incl. ties",m2,133.92,3.33,130.59,12000,1567080,DWG-01,manual,verified,12.4 m polyline on DWG-01 × 2.7 m height × 4 typical floors = 133.92 m2',
  );
  assert.equal(lines[2], "Bill No. 1 — Measured by hand,F10 Brick/block walling,,\"Blocks to BS 6073, 3.5 N/mm2\",,,,,,,,ai,,");
  // the second bill starts a fresh section and names its sheet by title when it has no code
  assert.equal(lines[3], "Bill No. 2,,,Contingency (Provisional),item,1,,1,500000,500000,First floor,ai,ai_generated,");
});

test("csvFileName is the session title made safe, with the takeoff suffix", () => {
  assert.equal(csvFileName("Ogudu Villa / Rev B"), "Ogudu-Villa-Rev-B-takeoff.csv");
  assert.equal(csvFileName("///"), "session-takeoff.csv");
});
