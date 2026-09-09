import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseViewports, scaleAt, scaleClause, viewportAt } from "./viewports.ts";
import { preconService } from "./service.ts";
import type { PreconRepository } from "./repository.ts";
import type { PreconBoqRowRow, PreconSheetRow, SheetViewport } from "./types.ts";

// A details sheet at 1:100 with a 1:20 detail in its corner: a drawing whose
// first vertex sits in the detail is measured at 1:20, anything else at 1:100.

const SHEET_MM_PER_PT = 35.28; // 1:100
const DETAIL_MM_PER_PT = 7.056; // 1:20
const detail: SheetViewport = { id: "vp_1", label: "Detail A", rect: [500, 500, 800, 800], scaleMmPerPt: DETAIL_MM_PER_PT };

function sheet(overrides: Partial<PreconSheetRow> = {}): PreconSheetRow {
  return {
    id: "pcsh_1",
    session_id: "pcs_1",
    file_name: "details.pdf",
    storage_path: "org/details.pdf",
    page_number: 1,
    code: "SHT-01",
    title: "Details",
    kind: "detail",
    status: "measured",
    scale_mm_per_pt: SHEET_MM_PER_PT,
    scale_confidence: 1,
    dim_unit: "mm",
    snap_index: null,
    geo_summary: null,
    viewports: [detail],
    error: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

test("viewportAt: the viewport holding the point, the smallest when they nest, none outside", () => {
  const big: SheetViewport = { id: "vp_2", label: "Plan", rect: [0, 0, 1000, 1000], scaleMmPerPt: SHEET_MM_PER_PT };
  assert.equal(viewportAt([big, detail], 600, 600)?.id, "vp_1");
  assert.equal(viewportAt([big, detail], 100, 100)?.id, "vp_2");
  assert.equal(viewportAt([detail], 100, 100), null);
  assert.equal(viewportAt(null, 100, 100), null);
});

test("scaleAt: first vertex inside a viewport picks its scale, else the sheet's; neither is an error", () => {
  assert.deepEqual(scaleAt(sheet(), [[600, 600], [100, 100]]), { mmPerPt: DETAIL_MM_PER_PT, viewport: detail });
  assert.deepEqual(scaleAt(sheet(), [[100, 100], [600, 600]]), { mmPerPt: SHEET_MM_PER_PT, viewport: null });
  assert.equal(scaleAt(sheet({ scale_mm_per_pt: null }), [[600, 600]]).mmPerPt, DETAIL_MM_PER_PT, "a viewport scale works without a sheet scale");
  assert.throws(() => scaleAt(sheet({ scale_mm_per_pt: null }), [[100, 100]]), /Set the sheet scale first/);
});

test("scaleClause names the viewport and its paper scale on a PDF, mm per unit on a DWG", () => {
  assert.equal(scaleClause(sheet(), { mmPerPt: DETAIL_MM_PER_PT, viewport: detail }), " in viewport Detail A at 1:20");
  assert.equal(scaleClause(sheet(), { mmPerPt: SHEET_MM_PER_PT, viewport: null }), "");
  assert.equal(scaleClause({ file_name: "plan.dwg" }, { mmPerPt: 0.5, viewport: detail }), " in viewport Detail A at 0.5 mm per unit");
});

test("normaliseViewports: rects are ordered, ids minted, and bad input named", () => {
  const [v] = normaliseViewports([{ label: " Detail B ", rect: [800, 900, 500, 600], scaleMmPerPt: 7 }]);
  assert.equal(v!.label, "Detail B");
  assert.deepEqual(v!.rect, [500, 600, 800, 900]);
  assert.match(v!.id, /^vp_/);
  assert.equal(normaliseViewports([{ id: "keep", label: "A", rect: [0, 0, 1, 1], scaleMmPerPt: 1 }])[0]!.id, "keep");
  assert.throws(() => normaliseViewports([{ label: "  ", rect: [0, 0, 1, 1], scaleMmPerPt: 1 }]), /label/);
  assert.throws(() => normaliseViewports([{ label: "A", rect: [0, 0, 0, 5], scaleMmPerPt: 1 }]), /no area/);
  assert.throws(() => normaliseViewports([{ label: "A", rect: [0, 0, 1, 1], scaleMmPerPt: 0 }]), /positive scale/);
  assert.throws(() => normaliseViewports([{ label: "A", rect: [0, 0, 1, Number.NaN], scaleMmPerPt: 1 }]), /four numbers/);
  assert.throws(
    () =>
      normaliseViewports([
        { id: "x", label: "A", rect: [0, 0, 1, 1], scaleMmPerPt: 1 },
        { id: "x", label: "B", rect: [0, 0, 1, 1], scaleMmPerPt: 1 },
      ]),
    /used twice/,
  );
});

function repoWith(sheetRow: PreconSheetRow): { repo: PreconRepository; rows: PreconBoqRowRow[]; patches: Partial<PreconBoqRowRow>[] } {
  const rows: PreconBoqRowRow[] = [];
  const patches: Partial<PreconBoqRowRow>[] = [];
  const existing: PreconBoqRowRow = {
    id: "pbr_1",
    bill_id: "pbl_1",
    sort: 0,
    row_type: "item",
    element_group: "walls",
    code: null,
    description: "Wall",
    unit: "m",
    qty_gross: 4,
    deductions: [],
    typical: 1,
    qty: 4,
    rate: null,
    amount: null,
    rate_source: null,
    confidence: "high",
    status: "verified",
    version: 1,
    measurement_basis: "4 m length on SHT-01",
    confidence_reason: null,
    provenance: null,
    origin: "manual",
    edited_at: null,
    edited_by: null,
    verified_by: "u_1",
    verified_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const repo = {
    sessionById: async () => ({ id: "pcs_1", org_id: "org_1", takeoff_kind: "manual" }),
    sheetById: async () => sheetRow,
    sheetsBySession: async () => [sheetRow],
    billsBySession: async () => [{ id: "pbl_1", session_id: "pcs_1", title: "Bill No. 1", sort: 0, created_at: new Date() }],
    nextRowSort: async () => 0,
    insertBoqRow: async (row: PreconBoqRowRow) => {
      rows.push(row);
      return { ...row, created_at: new Date(), updated_at: new Date() };
    },
    insertGeometries: async () => undefined,
    insertAuditEvent: async () => undefined,
    rowById: async () => existing,
    sessionIdForRow: async () => "pcs_1",
    geometriesByRow: async () => [{ sheet_id: "pcsh_1" }],
    updateRowVersioned: async (_id: string, version: number, patch: Partial<PreconBoqRowRow>) => {
      patches.push(patch);
      return { ...existing, ...patch, version: version + 1 };
    },
    replaceRowGeometry: async () => undefined,
    rowsBySession: async () => [],
  } as unknown as PreconRepository;
  return { repo, rows, patches };
}

test("a measurement drawn inside a viewport is measured at the viewport scale and says so", async () => {
  const { repo } = repoWith(sheet());
  // 100 pt at 1:20 is 705.6 mm; at the sheet's 1:100 it would read 3.53 m
  const { row } = await preconService(repo).createMeasurement(
    "pcs_1",
    { sheetId: "pcsh_1", tool: "length", vertices: [[600, 600], [700, 600]], description: "Skirting", elementGroup: "finishes" },
    "u_1",
  );
  assert.equal(row.qty, 0.71);
  assert.equal(row.measurementBasis, "0.71 m length on SHT-01 in viewport Detail A at 1:20");
});

test("the same drawing outside every viewport uses the sheet scale", async () => {
  const { row } = await preconService(repoWith(sheet()).repo).createMeasurement(
    "pcs_1",
    { sheetId: "pcsh_1", tool: "length", vertices: [[100, 100], [200, 100]], description: "Skirting", elementGroup: "finishes" },
    "u_1",
  );
  assert.equal(row.qty, 3.53);
  assert.equal(row.measurementBasis, "3.53 m length on SHT-01");
});

test("PUT geometry and a deduction inside a viewport pick its scale too", async () => {
  const { repo } = repoWith(sheet());
  const svc = preconService(repo);
  const redrawn = await svc.updateGeometry("pbr_1", { version: 1, kind: "linear", vertices: [[600, 600], [700, 600]] }, "u_1");
  assert.equal(redrawn.qtyGross, 0.71);
  assert.match(redrawn.measurementBasis ?? "", /in viewport Detail A at 1:20/);
  const deducted = await svc.addDeduction("pbr_1", { version: 1, label: "Opening", vertices: [[600, 600], [700, 600], [700, 700], [600, 700]] }, "u_1");
  assert.equal(deducted.deductions[0]!.qty, 0.5);
  assert.equal(deducted.deductions[0]!.label, "Opening in viewport Detail A at 1:20");
});
