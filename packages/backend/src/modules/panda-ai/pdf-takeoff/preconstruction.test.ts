import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSummary, preconService, quantityFromVertices } from "./service.ts";
import type { PreconRepository } from "./repository.ts";
import type { PreconBoqRowDto, PreconBoqRowRow } from "./types.ts";

function itemRow(overrides: Partial<PreconBoqRowRow> = {}): PreconBoqRowRow {
  return {
    id: "pbr_1",
    bill_id: "pbl_1",
    sort: 0,
    row_type: "item",
    element_group: "Walls",
    code: "F10/125",
    description: "225mm sandcrete blockwork",
    unit: "m2",
    qty_gross: 52,
    deductions: [{ label: "Door D1", qty: 5.8, geometryId: null }],
    qty: 46.2,
    rate: 12000,
    amount: 554400,
    rate_source: null,
    confidence: "high",
    status: "ai_generated",
    version: 1,
    measurement_basis: "centreline x height",
    verified_by: null,
    verified_at: null,
    created_at: new Date("2026-07-12T00:00:00Z"),
    updated_at: new Date("2026-07-12T00:00:00Z"),
    ...overrides,
  };
}

function fakeRepo(overrides: Partial<Record<keyof PreconRepository, unknown>> = {}): PreconRepository {
  const audits: unknown[] = [];
  return {
    rowById: async () => itemRow(),
    sessionIdForRow: async () => "pcs_1",
    updateRowVersioned: async (_id: string, version: number, patch: Partial<PreconBoqRowRow>) =>
      version === 1 ? { ...itemRow(), ...patch, version: 2 } : null,
    insertAuditEvent: async (e: unknown) => {
      audits.push(e);
    },
    geometriesByRow: async () => [],
    rowsBySession: async () => [],
    sheetById: async () => null,
    ...overrides,
  } as unknown as PreconRepository;
}

test("computeSummary applies Moniepoint-style arithmetic", () => {
  const rows = [
    { rowType: "item", amount: 1000, status: "ai_generated" },
    { rowType: "provisional_sum", amount: 500, status: "ai_generated" },
    { rowType: "item", amount: 999, status: "rejected" }, // rejected rows excluded
    { rowType: "spec_note", amount: null, status: null },
  ] as unknown as PreconBoqRowDto[];
  const s = computeSummary(rows, { prelimsPct: 5, contingencyPct: 5, vatPct: 7.5 });
  assert.equal(s.measuredTotal, 1500);
  assert.equal(s.prelims, 75);
  assert.equal(s.constructionSum, 1575);
  assert.equal(s.contingency, 78.75);
  assert.equal(s.subTotal, 1653.75);
  assert.equal(s.vat, 124.03);
  assert.equal(s.grandTotal, 1777.78);
});

test("quantityFromVertices: shoelace area at scale", () => {
  // 4m x 3m rectangle at 17.68 mm/pt: 4000/17.68 x 3000/17.68 pts
  const w = 4000 / 17.68;
  const h = 3000 / 17.68;
  const { quantity, unit } = quantityFromVertices("area", [[0, 0], [w, 0], [w, h], [0, h]], 17.68);
  assert.equal(unit, "m2");
  assert.ok(Math.abs(quantity - 12) < 0.01, `expected ~12, got ${quantity}`);
});

test("quantityFromVertices: linear and count", () => {
  const { quantity, unit } = quantityFromVertices("linear", [[0, 0], [100, 0], [100, 50]], 10);
  assert.equal(unit, "m");
  assert.equal(quantity, 1.5);
  assert.deepEqual(quantityFromVertices("count", [[1, 1], [2, 2], [3, 3]], 10), { quantity: 3, unit: "nr" });
});

test("updateRow recomputes amount and demotes verified rows", async () => {
  const events: { sessionId: string; type: string }[] = [];
  const svc = preconService(
    fakeRepo({ rowById: (async () => itemRow({ status: "verified", verified_by: "u_1" })) as never }),
    (sessionId, e) => events.push({ sessionId, type: e.type }),
  );
  const dto = await svc.updateRow("pbr_1", { version: 1, changes: { qty: 50 } }, "u_2");
  assert.equal(dto.version, 2);
  assert.equal(dto.qty, 50);
  assert.equal(dto.amount, 600000); // 50 x 12000 recomputed server-side
  assert.equal(dto.status, "needs_review"); // edit invalidates verification
  assert.deepEqual(events, [{ sessionId: "pcs_1", type: "row.updated" }]);
});

test("updateRow throws ConflictError on version mismatch", async () => {
  const svc = preconService(fakeRepo());
  await assert.rejects(svc.updateRow("pbr_1", { version: 7, changes: { qty: 1 } }, "u_1"), /refresh/i);
});

test("verifyRow stamps verifier and is idempotent for verified rows", async () => {
  const svc = preconService(fakeRepo());
  const dto = await svc.verifyRow("pbr_1", 1, "u_9");
  assert.equal(dto.status, "verified");
  assert.equal(dto.verifiedBy, "u_9");

  const already = await preconService(
    fakeRepo({ rowById: (async () => itemRow({ status: "verified", verified_by: "u_1" })) as never }),
  ).verifyRow("pbr_1", 1, "u_2");
  assert.equal(already.verifiedBy, "u_1"); // no re-stamp
});

test("verifyRow rejects non-reviewable rows", async () => {
  const svc = preconService(fakeRepo({ rowById: (async () => itemRow({ status: null, row_type: "heading" })) as never }));
  await assert.rejects(svc.verifyRow("pbr_1", 1, "u_1"), /not a reviewable/i);
});

test("addDeduction recomputes net from gross server-side", async () => {
  const inserted: unknown[] = [];
  const svc = preconService(
    fakeRepo({
      geometriesByRow: (async () => [{ sheet_id: "pcsh_1" }]) as never,
      sheetById: (async () => ({ id: "pcsh_1", session_id: "pcs_1", scale_mm_per_pt: 10 })) as never,
      insertGeometries: (async (rows: unknown[]) => {
        inserted.push(...rows);
      }) as never,
    }),
  );
  // 1m x 1m opening at 10mm/pt = 100x100pt square = 1 m2
  const dto = await svc.addDeduction(
    "pbr_1",
    { version: 1, label: "Window W2", vertices: [[0, 0], [100, 0], [100, 100], [0, 100]] },
    "u_1",
  );
  assert.equal(dto.deductions.length, 2);
  assert.equal(dto.deductions[1]!.qty, 1);
  // gross 52 - (5.8 + 1) = 45.2
  assert.equal(dto.qty, 45.2);
  assert.equal(inserted.length, 1);
});

test("editing an anchor row recomputes derived rows from their formulas", async () => {
  const derivedRow = itemRow({
    id: "pbr_derived",
    code: "7.2.0",
    description: "Plastering to Walls 12mm thick; over 600mm wide",
    qty: 8085.5,
    qty_gross: 8085.5,
    rate: 100,
    amount: 808550,
    measurement_basis: "Derived: 2 * wall_area_m2 = 8085.5 (engine-evaluated over measured anchors)",
  });
  const anchorRow = itemRow({ id: "pbr_1", code: "F10/125", qty: 4042.75, deductions: [] });
  const recomputes: { id: string; qty: number; amount: number | null }[] = [];
  const svc = preconService(
    fakeRepo({
      rowById: (async () => anchorRow) as never,
      rowsBySession: (async () => [{ ...anchorRow, qty: 1000 }, derivedRow]) as never,
      updateRowVersioned: (async (_id: string, _v: number, patch: Partial<PreconBoqRowRow>) => ({
        ...anchorRow,
        ...patch,
        version: 2,
      })) as never,
      applyDerivedRecompute: (async (id: string, qty: number, amount: number | null) => {
        recomputes.push({ id, qty, amount });
        return { ...derivedRow, qty, amount, version: derivedRow.version + 1 };
      }) as never,
    }),
  );
  await svc.updateRow("pbr_1", { version: 1, changes: { qty: 1000 } }, "u_qs");
  assert.equal(recomputes.length, 1);
  assert.equal(recomputes[0]!.id, "pbr_derived");
  assert.equal(recomputes[0]!.qty, 2000); // 2 x corrected wall area
  assert.equal(recomputes[0]!.amount, 200000);
});

test("createRow prices a hand-entered item and lands it verified", async () => {
  let inserted: PreconBoqRowRow | null = null;
  const events: string[] = [];
  const svc = preconService(
    fakeRepo({
      billById: (async () => ({ id: "pbl_1", session_id: "pcs_1", title: "Bill No. 1", sort: 0 })) as never,
      nextRowSort: (async () => 7) as never,
      insertBoqRow: (async (row: PreconBoqRowRow) => {
        inserted = row;
        return row;
      }) as never,
    }),
    (_sessionId, e) => events.push(e.type),
  );

  const row = await svc.createRow(
    "pbl_1",
    { description: "150mm hardcore filling", unit: "m2", qty: 12.5, rate: 4000 },
    "u_qs",
  );

  assert.equal(row.amount, 50000);
  assert.equal(row.status, "verified");
  assert.equal(row.rateSource, "manual");
  assert.equal(row.confidence, null);
  assert.equal(inserted!.sort, 7);
  assert.equal(inserted!.verified_by, "u_qs");
  assert.deepEqual(events, ["row.created"]);
});

test("createRow rejects quantities on a non-priced row type", async () => {
  const svc = preconService(
    fakeRepo({
      billById: (async () => ({ id: "pbl_1", session_id: "pcs_1", title: "Bill No. 1", sort: 0 })) as never,
      nextRowSort: (async () => 0) as never,
      insertBoqRow: (async (row: PreconBoqRowRow) => row) as never,
    }),
  );

  await assert.rejects(
    svc.createRow("pbl_1", { rowType: "heading", description: "Substructure", qty: 5 }, "u_qs"),
    /priced rows carry quantities/i,
  );
});

test("createRow leaves a heading unpriced and unreviewable", async () => {
  const svc = preconService(
    fakeRepo({
      billById: (async () => ({ id: "pbl_1", session_id: "pcs_1", title: "Bill No. 1", sort: 0 })) as never,
      nextRowSort: (async () => 0) as never,
      insertBoqRow: (async (row: PreconBoqRowRow) => row) as never,
    }),
  );

  const row = await svc.createRow("pbl_1", { rowType: "heading", description: "Substructure" }, "u_qs");
  assert.equal(row.status, null);
  assert.equal(row.qty, null);
  assert.equal(row.amount, null);
});

test("removeRow deletes and keeps the row in the audit trail", async () => {
  const audits: { action: string; before: unknown }[] = [];
  const deleted: string[] = [];
  const svc = preconService(
    fakeRepo({
      deleteRow: (async (id: string) => {
        deleted.push(id);
      }) as never,
      insertAuditEvent: (async (e: { action: string; before: unknown }) => {
        audits.push(e);
      }) as never,
    }),
  );

  await svc.removeRow("pbr_1", "u_qs");

  assert.deepEqual(deleted, ["pbr_1"]);
  assert.equal(audits[0]!.action, "deleted");
  assert.equal((audits[0]!.before as PreconBoqRowDto).description, "225mm sandcrete blockwork");
});

test("createBlankSession opens in review with one bill and default settings", async () => {
  const bills: { title: string }[] = [];
  let settings: { prelims_pct: number } | null = null;
  const svc = preconService(
    fakeRepo({
      insertSession: (async (row: Record<string, unknown>) => ({
        ...row,
        structure_context: null,
        programme_start_date: null,
        created_at: new Date(),
        updated_at: new Date(),
      })) as never,
      insertBill: (async (row: { title: string }) => {
        bills.push(row);
        return row;
      }) as never,
      upsertSettings: (async (row: { prelims_pct: number }) => {
        settings = row;
      }) as never,
    }),
  );

  const session = await svc.createBlankSession("org_1", "Renovation pricing", "u_qs", "prop_1");

  assert.equal(session.status, "reviewing");
  assert.equal(session.proposalId, "prop_1");
  assert.deepEqual(bills.map((b) => b.title), ["Bill No. 1"]);
  assert.equal(settings!.prelims_pct, 5);
});

test("editing a hand-entered row keeps it verified, unlike an AI row", async () => {
  const manual = itemRow({ status: "verified", confidence: null, verified_by: "u_qs" });
  const svc = preconService(fakeRepo({ rowById: (async () => manual) as never }));
  const row = await svc.updateRow("pbr_1", { version: 1, changes: { rate: 15000 } }, "u_qs");
  assert.equal(row.status, "verified");
  assert.equal(row.verifiedBy, "u_qs");
});

test("a never-measured row can be measured by naming the sheet", async () => {
  const svc = preconService(
    fakeRepo({
      // no prior geometry: a schedule-derived, provisional or hand-entered row
      rowById: (async () => itemRow({ deductions: [], qty_gross: null, qty: null })) as never,
      geometriesByRow: (async () => []) as never,
      sheetById: (async () => ({ id: "pcsh_1", session_id: "pcs_1", scale_mm_per_pt: 17.68 })) as never,
      replaceRowGeometry: (async () => undefined) as never,
    }),
  );

  const row = await svc.updateGeometry(
    "pbr_1",
    { version: 1, kind: "area", vertices: [[0, 0], [100, 0], [100, 100], [0, 100]], sheetId: "pcsh_1" },
    "u_qs",
  );

  assert.ok(row.qty !== null && row.qty > 0, `expected a measured quantity, got ${row.qty}`);
});
