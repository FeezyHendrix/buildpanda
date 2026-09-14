import { test } from "node:test";
import assert from "node:assert/strict";
import { basisWithTypical, netQuantity } from "./measurements.ts";
import { preconService } from "./service.ts";
import type { PreconRepository } from "./repository.ts";
import type { PreconBoqRowRow } from "./types.ts";

// net = (gross − Σdeductions) × typical: the drawn figure stays in qty_gross,
// the multiplier is its own column, and the basis names it.

function manualRow(overrides: Partial<PreconBoqRowRow> = {}): PreconBoqRowRow {
  return {
    id: "pbr_1",
    bill_id: "pbl_1",
    sort: 0,
    row_type: "item",
    element_group: "walls",
    code: null,
    description: "225 blockwork",
    unit: "m2",
    qty_gross: 12.4,
    deductions: [],
    typical: 1,
    qty: 12.4,
    rate: 1000,
    amount: 12400,
    rate_source: "manual",
    confidence: "high",
    status: "verified",
    version: 1,
    measurement_basis: "12.4 m2 area on DWG-01",
    confidence_reason: null,
    provenance: "Measured by hand on DWG-01 by u_1",
    origin: "manual",
    edited_at: null,
    edited_by: null,
    verified_by: "u_1",
    verified_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function fakeRepo(row: PreconBoqRowRow): { repo: PreconRepository; patches: Partial<PreconBoqRowRow>[] } {
  const patches: Partial<PreconBoqRowRow>[] = [];
  const repo = {
    rowById: async () => row,
    sessionIdForRow: async () => "pcs_1",
    updateRowVersioned: async (_id: string, version: number, patch: Partial<PreconBoqRowRow>) => {
      patches.push(patch);
      return version === row.version ? { ...row, ...patch, version: version + 1 } : null;
    },
    insertAuditEvent: async () => undefined,
    rowsBySession: async () => [],
    geometriesByRow: async () => [{ sheet_id: "pcsh_1" }],
    sheetById: async () => ({ id: "pcsh_1", session_id: "pcs_1", file_name: "plan.pdf", scale_mm_per_pt: 17.64, viewports: null }),
    insertGeometries: async () => undefined,
    replaceRowGeometry: async () => undefined,
  } as unknown as PreconRepository;
  return { repo, patches };
}

test("netQuantity: deductions come off the drawn figure before the multiplier", () => {
  assert.equal(netQuantity(12.4, [], 1), 12.4);
  assert.equal(netQuantity(12.4, [], 4), 49.6);
  assert.equal(netQuantity(12.4, [{ qty: 2.4 }], 4), 40);
  assert.equal(netQuantity(1, [{ qty: 3 }], 4), 0, "never negative");
});

test("basisWithTypical: adds, rewrites and removes the typical clause without touching the drawn figure", () => {
  assert.equal(basisWithTypical("12.4 m2 area on DWG-01", 12.4, 49.6, 4, "m2"), "12.4 m2 area on DWG-01 × 4 typical floors = 49.6 m2");
  assert.equal(
    basisWithTypical("12.4 m polyline on DWG-01 × 2.7 m height × 4 typical floors = 133.92 m2", 33.48, 66.96, 2, "m2"),
    "12.4 m polyline on DWG-01 × 2.7 m height × 2 typical floors = 66.96 m2",
  );
  assert.equal(
    basisWithTypical("12.4 m polyline on DWG-01 × 2.7 m height × 4 typical floors = 133.92 m2", 33.48, 33.48, 1, "m2"),
    "12.4 m polyline on DWG-01 × 2.7 m height = 33.48 m2",
  );
  assert.equal(basisWithTypical("12.4 m2 area on DWG-01 × 4 typical floors = 49.6 m2", 12.4, 12.4, 1, "m2"), "12.4 m2 area on DWG-01");
  assert.equal(basisWithTypical(null, 52, 104, 2, "m2"), "52 m2 × 2 typical floors = 104 m2");
  assert.equal(basisWithTypical(null, 52, 52, 1, "m2"), null);
});

test("PATCH typical recomputes qty and amount from qty_gross and rewrites the basis", async () => {
  const row = manualRow({ deductions: [{ label: "D1", qty: 2.4, geometryId: null }], qty: 10 });
  const { repo, patches } = fakeRepo(row);
  const dto = await preconService(repo).updateRow("pbr_1", { version: 1, changes: { typical: 4 } }, "u_1");
  assert.equal(dto.typical, 4);
  assert.equal(dto.qtyGross, 12.4, "the drawn figure is untouched");
  assert.equal(dto.qty, 40);
  assert.equal(dto.amount, 40000);
  assert.equal(dto.measurementBasis, "12.4 m2 area on DWG-01 × 4 typical floors = 40 m2");
  assert.equal(patches[0]!.typical, 4);
});

test("PATCH typical back to 1 restores the drawn quantity", async () => {
  const row = manualRow({ typical: 4, qty: 49.6, measurement_basis: "12.4 m2 area on DWG-01 × 4 typical floors = 49.6 m2" });
  const dto = await preconService(fakeRepo(row).repo).updateRow("pbr_1", { version: 1, changes: { typical: 1 } }, "u_1");
  assert.equal(dto.qty, 12.4);
  assert.equal(dto.measurementBasis, "12.4 m2 area on DWG-01");
});

test("PATCH typical rejects a fraction and a note row", async () => {
  await assert.rejects(preconService(fakeRepo(manualRow()).repo).updateRow("pbr_1", { version: 1, changes: { typical: 2.5 } }, "u_1"), /whole number/);
  await assert.rejects(
    preconService(fakeRepo(manualRow({ row_type: "spec_note" })).repo).updateRow("pbr_1", { version: 1, changes: { typical: 2 } }, "u_1"),
    /priced rows/,
  );
});

test("redrawing a typical row keeps the multiplier: net = drawn × typical", async () => {
  const row = manualRow({ typical: 3, qty: 37.2 });
  const dto = await preconService(fakeRepo(row).repo).updateGeometry(
    "pbr_1",
    { version: 1, kind: "area", vertices: [[0, 0], [4000 / 17.64, 0], [4000 / 17.64, 3000 / 17.64], [0, 3000 / 17.64]] },
    "u_1",
  );
  assert.equal(dto.qtyGross, 12);
  assert.equal(dto.qty, 36);
  assert.match(dto.measurementBasis ?? "", /gross 12 m2 × 3 typical floors = 36 m2/);
});

test("a deduction on a typical row comes off every floor", async () => {
  const row = manualRow({ typical: 2, qty: 24.8 });
  const dto = await preconService(fakeRepo(row).repo).addDeduction(
    "pbr_1",
    { version: 1, label: "Door", vertices: [[0, 0], [1000 / 17.64, 0], [1000 / 17.64, 2000 / 17.64], [0, 2000 / 17.64]] },
    "u_1",
  );
  assert.equal(dto.deductions[0]!.qty, 2);
  assert.equal(dto.qty, 20.8);
});
