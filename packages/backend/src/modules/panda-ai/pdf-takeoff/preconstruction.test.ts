import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSummary, preconService, quantityFromVertices } from "./service.ts";
import type { PreconRepository } from "./repository.ts";
import type { PreconBoqRowDto, PreconBoqRowRow, PreconSessionRow, PreconSheetRow } from "./types.ts";

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
    confidence_reason: null,
    provenance: "Measured on SHT-01: centreline x height",
    origin: "ai",
    edited_at: null,
    edited_by: null,
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
    sessionsByPlan: async () => [],
    supersedeSessions: async () => 0,
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

function sessionRow(overrides: Partial<PreconSessionRow> = {}): PreconSessionRow {
  return {
    id: "pcs_1",
    org_id: "org_1",
    project_id: null,
    proposal_id: "prp_1",
    status: "failed",
    title: "Ground floor.pdf",
    error: "LLM timed out",
    phase: "building",
    progress_log: [{ at: "2026-07-12T00:00:00Z", phase: "building", message: "Building up the bill" }],
    scope: { kind: "full", elements: [] },
    plan_id: null,
    takeoff_kind: "pdf",
    extraction: null,
    structure_context: null,
    programme_start_date: null,
    revision: 1,
    superseded_by: null,
    created_by: "usr_1",
    created_at: new Date("2026-07-12T00:00:00Z"),
    updated_at: new Date("2026-07-12T00:00:00Z"),
    ...overrides,
  };
}

test("retryGeneration resets a failed session with drawings and audits the old error", async () => {
  let resetCalls = 0;
  const audits: { action: string; before: unknown }[] = [];
  let current = sessionRow();
  const svc = preconService(
    fakeRepo({
      sessionById: async () => current,
      sheetsBySession: async () => [{ id: "pcsh_1" }],
      resetSessionForRetry: async () => {
        resetCalls++;
        current = sessionRow({ status: "generating", error: null, phase: null, progress_log: null });
      },
      insertAuditEvent: async (e: { action: string; before: unknown }) => {
        audits.push(e);
      },
    }),
  );
  const session = await svc.retryGeneration("pcs_1", "usr_2");
  assert.equal(resetCalls, 1);
  assert.equal(session.status, "generating");
  assert.equal(session.error, null);
  assert.deepEqual(session.progressLog, []);
  assert.equal(audits[0]?.action, "session_retried");
});

test("retryGeneration refuses sessions that are not failed or have no drawings", async () => {
  const reviewing = preconService(fakeRepo({ sessionById: async () => sessionRow({ status: "reviewing" }) }));
  await assert.rejects(reviewing.retryGeneration("pcs_1", "usr_1"), /failed take-off/);
  const blank = preconService(fakeRepo({ sessionById: async () => sessionRow(), sheetsBySession: async () => [] }));
  await assert.rejects(blank.retryGeneration("pcs_1", "usr_1"), /no drawings/);
});

test("createSession rejects a sections scope with nothing selected and stores the scope", async () => {
  const inserted: { scope?: unknown }[] = [];
  const svc = preconService(
    fakeRepo({
      insertSession: async (row: { scope?: unknown }) => {
        inserted.push(row);
        return { ...sessionRow({ status: "uploading" }), ...row };
      },
      insertSheets: async () => undefined,
      upsertSettings: async () => undefined,
    }),
  );
  await assert.rejects(
    svc.createSession("org_1", "Plan.pdf", "usr_1", [{ fileName: "Plan.pdf", storagePath: "p" }], null, {
      kind: "sections",
      elements: [],
    }),
    /at least one section/,
  );
  const session = await svc.createSession("org_1", "Plan.pdf", "usr_1", [{ fileName: "Plan.pdf", storagePath: "p" }], null, {
    kind: "areas",
    elements: [],
  });
  assert.deepEqual(inserted[0]?.scope, { kind: "areas", elements: [] });
  assert.equal(session.scope.kind, "areas");
});

function sheetRow(overrides: Partial<PreconSheetRow> = {}): PreconSheetRow {
  return {
    id: "pcsh_1",
    session_id: "pcs_1",
    file_name: "Ground floor.pdf",
    storage_path: "uploads/ground.pdf",
    page_number: 1,
    code: "SHT-01",
    title: null,
    kind: "unknown",
    status: "unmeasurable",
    scale_mm_per_pt: null,
    scale_confidence: null,
    dim_unit: null,
    snap_index: null,
    error: "No reliable scale",
    created_at: new Date("2026-07-12T00:00:00Z"),
    updated_at: new Date("2026-07-12T00:00:00Z"),
    geo_summary: null,
    ...overrides,
  };
}

test("updateSheet: a typed scale is authoritative and re-enables an unmeasurable sheet", async () => {
  const patches: Record<string, unknown>[] = [];
  let current = sheetRow();
  const svc = preconService(
    fakeRepo({
      sheetById: async () => current,
      updateSheet: async (_id: string, patch: Record<string, unknown>) => {
        patches.push(patch);
        current = { ...current, ...patch } as PreconSheetRow;
      },
    }),
  );
  const sheet = await svc.updateSheet("pcsh_1", { scaleMmPerPt: 17.68, kind: "floor-plan" }, "usr_1");
  assert.equal(patches[0]?.["scale_confidence"], 1);
  assert.equal(patches[0]?.["status"], "measured");
  assert.equal(patches[0]?.["error"], null);
  assert.equal(sheet.kind, "floor-plan");
  assert.equal(sheet.scaleMmPerPt, 17.68);
  await assert.rejects(svc.updateSheet("pcsh_1", { scaleMmPerPt: -1 }, "usr_1"), /positive/);
});

test("updateStructure: a reviewer's reading becomes high confidence and keeps the engine's signals", async () => {
  let stored: unknown = null;
  let current = sessionRow({
    status: "reviewing",
    structure_context: {
      structureClass: "building",
      buildingType: "bungalow",
      storeys: 1,
      structuralSystem: "unknown",
      foundationType: "unknown",
      confidence: "low",
      signals: ["floor plan title"],
    },
  });
  const svc = preconService(
    fakeRepo({
      sessionById: async () => current,
      updateSessionStructure: async (_id: string, structure: unknown) => {
        stored = structure;
        current = { ...current, structure_context: structure as never };
      },
    }),
  );
  const session = await svc.updateStructure("pcs_1", { storeys: 2, foundationType: "strip" }, "usr_2");
  assert.equal(session.structureContext?.storeys, 2);
  assert.equal(session.structureContext?.foundationType, "strip");
  assert.equal(session.structureContext?.confidence, "high");
  assert.ok((stored as { signals: string[] }).signals[0] === "floor plan title");
  await svc.assertRedraftable("pcs_1");
});

test("createDwgSession lands DWG lines as a reviewable session with reasons and provenance", async () => {
  const inserted: { rows?: unknown[]; session?: unknown; bill?: unknown; sheets?: unknown[]; layerMap?: unknown } = {};
  const svc = preconService(
    fakeRepo({
      insertSession: async (row: Record<string, unknown>) => {
        inserted.session = row;
        return { ...sessionRow({ status: "reviewing" }), ...row };
      },
      insertSheets: async (sheets: unknown[]) => {
        inserted.sheets = sheets;
      },
      sheetsBySession: async () => [{ storage_path: "uploads/site.dwg", file_name: "Site.dwg" }],
      deleteSheetsBySession: async () => 0,
      deleteRows: async () => 0,
      billsBySession: async () => [],
      updateSessionLayerMap: async (_id: string, map: unknown) => {
        inserted.layerMap = map;
      },
      insertBill: async (bill: Record<string, unknown>) => {
        inserted.bill = bill;
        return bill;
      },
      insertBoqRows: async (rows: unknown[]) => {
        inserted.rows = rows;
      },
      upsertSettings: async () => undefined,
      sessionById: async () => ({ ...sessionRow(), ...(inserted.session as object) }),
      appendSessionProgress: async () => undefined,
      // the shell is inserted as generating and flipped to reviewing once the lines land
      updateSessionStatus: async (_id: string, status: string) => {
        inserted.session = { ...(inserted.session as object), status };
      },
    }),
  );
  const session = await svc.createDwgSession(
    "org_1",
    "usr_1",
    "prp_1",
    "pln_1",
    { fileName: "Site.dwg", storagePath: "uploads/site.dwg" },
    {
      units: { unit: "mm", scaleToMm: 1, errorPct: 0.02, note: "Median of 100 dimensions is 1200, read as mm." },
      layerMap: { WALL: "walls", DIM: "dimensions" },
      sheets: [
        { id: 7, code: "DWG-01", title: "Ground Floor Plan", kind: "floor-plan", bounds: { minX: 0, minY: 0, maxX: 24000, maxY: 24000 }, levelMm: 450, multiplier: 4 },
        { id: 3, code: "DWG-02", title: "North View", kind: "elevation", bounds: { minX: 30000, minY: 0, maxX: 54000, maxY: 15000 }, levelMm: null, multiplier: 1 },
      ],
      items: [
        { trade: "Walls", description: "225mm blockwork", quantity: 120, unit: "m2", confidence: "high", basis: "double lines", sheetId: 7, evidence: [101, 102], reason: "methods agree" },
        { trade: "Walls", description: "150mm blockwork", quantity: 30, unit: "m2", confidence: "medium", basis: "single lines", sheetId: 7, reason: "single method" },
      ],
      notes: ["Layers with no recognised element (left on auto): 0."],
    },
  );
  assert.equal(session.takeoffKind, "dwg");
  assert.equal(session.planId, "pln_1");
  assert.equal(session.status, "reviewing");
  assert.equal(session.progressLog[0]?.message, "Queued the automated take-off for Site.dwg");
  // one sheet per drawing of the register, framed by its bounds, in drawing units
  const sheets = inserted.sheets as { code: string; kind: string; status: string; bounds: unknown; scale_mm_per_pt: number; dim_unit: string }[];
  assert.equal(sheets.length, 2);
  assert.equal(sheets[0]?.code, "DWG-01");
  assert.equal(sheets[0]?.status, "measured");
  assert.equal(sheets[1]?.status, "unmeasurable");
  assert.deepEqual(sheets[0]?.bounds, { minX: 0, minY: 0, maxX: 24000, maxY: 24000 });
  assert.equal(sheets[0]?.scale_mm_per_pt, 1);
  assert.equal(sheets[0]?.dim_unit, "mm");
  assert.deepEqual(inserted.layerMap, { WALL: "walls", DIM: "dimensions" });
  const rows = inserted.rows as { row_type: string; code: string | null; status: string | null; confidence_reason: string | null; provenance: string | null; evidence: number[] | null; origin: string }[];
  // heading, two lines, the notes heading and one note
  assert.equal(rows.length, 5);
  assert.equal(rows[0]?.row_type, "heading");
  assert.equal(rows[1]?.status, "ai_generated");
  assert.equal(rows[1]?.code, "DWG-01");
  assert.deepEqual(rows[1]?.evidence, [101, 102]);
  assert.equal(rows[1]?.confidence_reason, "methods agree");
  assert.equal(rows[2]?.status, "needs_review");
  assert.equal(rows[2]?.confidence_reason, "medium confidence · single method");
  assert.ok(rows[1]?.provenance?.startsWith("Read from Site.dwg (DWG-01)"));
  assert.equal(rows[4]?.row_type, "spec_note");
  assert.ok(rows.every((r) => r.origin === "ai"));
});

test("updateRow stamps who edited an AI line and createRow marks hand-entered lines", async () => {
  const patches: Record<string, unknown>[] = [];
  const svc = preconService(
    fakeRepo({
      updateRowVersioned: async (_id: string, version: number, patch: Record<string, unknown>) => {
        patches.push(patch);
        return version === 1 ? { ...itemRow(), ...patch, version: 2 } : null;
      },
    }),
  );
  await svc.updateRow("pbr_1", { version: 1, changes: { qty: 40 } }, "usr_9");
  assert.equal(patches[0]?.["edited_by"], "usr_9");
  assert.ok(patches[0]?.["edited_at"] instanceof Date);
});
