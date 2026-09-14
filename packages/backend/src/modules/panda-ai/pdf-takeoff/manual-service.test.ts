import { test } from "node:test";
import assert from "node:assert/strict";
import { preconService } from "./service.ts";
import { MANUAL_BILL_TITLE } from "./manual-service.ts";
import { nextRevision } from "./revisions.ts";
import type { PreconRepository } from "./repository.ts";
import type { DwgTakeoffHandover, PreconBoqRowRow, PreconSessionRow, PreconSheetRow } from "./types.ts";

const MM_PER_PT = 17.64;
const pt = (mm: number) => mm / MM_PER_PT;

function sheet(overrides: Partial<PreconSheetRow> = {}): PreconSheetRow {
  return {
    id: "pcsh_1",
    session_id: "pcs_1",
    file_name: "plan.dwg",
    storage_path: "org/plan.dwg",
    page_number: 1,
    code: "DWG-01",
    title: "Ground floor",
    kind: "floor-plan",
    status: "measured",
    scale_mm_per_pt: MM_PER_PT,
    scale_confidence: 1,
    dim_unit: "mm",
    snap_index: null,
    geo_summary: null,
    error: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function session(overrides: Partial<PreconSessionRow> = {}): PreconSessionRow {
  return {
    id: "pcs_1",
    org_id: "org_1",
    project_id: null,
    proposal_id: "prp_1",
    status: "reviewing",
    title: "plan.dwg",
    error: null,
    phase: null,
    progress_log: null,
    scope: { kind: "full", elements: [] },
    plan_id: "pln_1",
    takeoff_kind: "manual",
    extraction: null,
    structure_context: null,
    programme_start_date: null,
    revision: 1,
    superseded_by: null,
    created_by: "usr_1",
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

interface Captured {
  rows: PreconBoqRowRow[];
  geometries: unknown[];
  audits: { action: string; after: Record<string, unknown> | null }[];
  sessions: Partial<PreconSessionRow>[];
  bills: { title: string }[];
  sheets: Partial<PreconSheetRow>[];
  superseded: string[][];
  sheetStatus: string[];
}

function fakeRepo(overrides: Partial<Record<keyof PreconRepository, unknown>> = {}): { repo: PreconRepository; got: Captured } {
  const got: Captured = { rows: [], geometries: [], audits: [], sessions: [], bills: [], sheets: [], superseded: [], sheetStatus: [] };
  const repo = {
    sessionById: async () => session(),
    sheetById: async () => sheet(),
    billsBySession: async () => [{ id: "pbl_1", session_id: "pcs_1", title: MANUAL_BILL_TITLE, sort: 0, created_at: new Date() }],
    billById: async () => null,
    nextRowSort: async () => 3,
    insertBoqRow: async (row: PreconBoqRowRow) => {
      const full = { ...row, created_at: new Date(), updated_at: new Date() };
      got.rows.push(full);
      return full;
    },
    insertBoqRows: async (rows: PreconBoqRowRow[]) => {
      got.rows.push(...rows);
    },
    insertGeometries: async (rows: unknown[]) => {
      got.geometries.push(...rows);
    },
    insertAuditEvent: async (e: { action: string; after: Record<string, unknown> | null }) => {
      got.audits.push(e);
    },
    sessionsByPlan: async () => [],
    supersedeSessions: async (ids: string[]) => {
      got.superseded.push(ids);
      return ids.length;
    },
    insertSession: async (row: Partial<PreconSessionRow>) => {
      got.sessions.push(row);
      return session(row);
    },
    insertSheets: async (rows: Partial<PreconSheetRow>[]) => {
      got.sheets.push(...rows);
    },
    insertBill: async (row: { title: string }) => {
      got.bills.push(row);
      return { ...row, created_at: new Date() };
    },
    upsertSettings: async () => undefined,
    sheetsBySession: async () => [sheet()],
    rowsBySession: async () => [],
    deleteRows: async () => 0,
    deleteAiGeometriesBySession: async () => 0,
    deleteSheetsBySession: async () => 0,
    updateSessionLayerMap: async () => undefined,
    appendSessionProgress: async () => undefined,
    updateSessionStatus: async (_id: string, status: string) => {
      got.sheetStatus.push(status);
    },
    ...overrides,
  } as unknown as PreconRepository;
  return { repo, got };
}

test("createMeasurement: a drawn wall lands verified by its author with evidence and a stated basis", async () => {
  const { repo, got } = fakeRepo();
  const events: unknown[] = [];
  const svc = preconService(repo, (_id, event) => events.push(event));
  const result = await svc.createMeasurement(
    "pcs_1",
    {
      sheetId: "pcsh_1",
      tool: "wall_area",
      vertices: [[0, 0], [pt(12400), 0]],
      description: "225mm blockwork",
      elementGroup: "walls",
      code: "F10/125",
      factor: { heightM: 2.7 },
      typical: 4,
      rate: 12000,
    },
    "usr_qs",
  );
  const { row, geometry } = result;
  assert.equal(row.origin, "manual");
  assert.equal(row.status, "verified");
  assert.equal(row.verifiedBy, "usr_qs");
  assert.equal(row.confidence, "high");
  assert.equal(row.confidenceReason, null);
  assert.equal(row.unit, "m2");
  // the drawn figure (after the height factor) stays gross; typical multiplies it into net
  assert.equal(row.qtyGross, 33.48);
  assert.equal(row.typical, 4);
  assert.equal(row.qty, 133.92);
  assert.equal(row.amount, 1607040);
  assert.equal(row.rateSource, "manual");
  assert.equal(row.measurementBasis, "12.4 m polyline on DWG-01 × 2.7 m height × 4 typical floors = 133.92 m2");
  assert.equal(row.provenance, "Measured by hand on DWG-01 by usr_qs");
  assert.equal(row.billId, "pbl_1");
  assert.equal(row.sort, 3);
  assert.equal(geometry.source, "manual");
  assert.equal(geometry.kind, "linear");
  assert.equal(geometry.quantity, 12.4);
  assert.equal(geometry.unit, "m");
  assert.equal(geometry.sheetId, "pcsh_1");
  assert.equal(got.geometries.length, 1);
  assert.equal(got.audits[0]?.action, "measured_by_hand");
  assert.equal((events[0] as { type: string }).type, "row.created");
});

test("createMeasurement: unit override and a plain length keep the basis short", async () => {
  const { repo } = fakeRepo();
  const svc = preconService(repo);
  const { row } = await svc.createMeasurement(
    "pcs_1",
    { sheetId: "pcsh_1", tool: "length", vertices: [[0, 0], [pt(4000), 0]], description: "Skirting", elementGroup: "finishes", unit: "lm" },
    "usr_qs",
  );
  assert.equal(row.unit, "lm");
  assert.equal(row.qty, 4);
  assert.equal(row.rate, null);
  assert.equal(row.amount, null);
  assert.equal(row.measurementBasis, "4 m length on DWG-01");
});

test("createMeasurement refuses a sheet without a scale, or from another session", async () => {
  const body = { sheetId: "pcsh_1", tool: "area" as const, vertices: [[0, 0], [10, 0], [10, 10]], description: "Slab", elementGroup: "floors" };
  const noScale = preconService(fakeRepo({ sheetById: async () => sheet({ scale_mm_per_pt: null }) }).repo);
  await assert.rejects(noScale.createMeasurement("pcs_1", body, "usr_qs"), /Set the sheet scale first/);
  const other = preconService(fakeRepo({ sheetById: async () => sheet({ session_id: "pcs_9" }) }).repo);
  await assert.rejects(other.createMeasurement("pcs_1", body, "usr_qs"), /Sheet/);
  const noBill = preconService(fakeRepo({ billById: async () => null }).repo);
  await assert.rejects(noBill.createMeasurement("pcs_1", { ...body, billId: "pbl_x" }, "usr_qs"), /Bill/);
});

test("createStatedMeasurement: a figure from a prompt is a manual row with no geometry and a prompt basis", async () => {
  const { repo, got } = fakeRepo();
  const svc = preconService(repo);
  const row = await svc.createStatedMeasurement(
    "pcs_1",
    { tool: "wall_area", qty: 12, factor: { heightM: 2.7 }, description: "225 wall", elementGroup: "walls" },
    "usr_qs",
  );
  assert.equal(row.qty, 32.4);
  assert.equal(row.unit, "m2");
  assert.equal(row.origin, "manual");
  assert.equal(row.status, "verified");
  assert.equal(row.measurementBasis, "12 m polyline stated in prompt × 2.7 m height = 32.4 m2");
  assert.match(row.provenance ?? "", /Panda AI prompt by usr_qs/);
  assert.equal(got.geometries.length, 0);
});

test("createManualSession: kind manual, one empty bill titled for hand measuring, its own lineage", async () => {
  const { repo, got } = fakeRepo({
    sessionsByPlan: async () => [
      session({ id: "pcs_ai", takeoff_kind: "pdf", revision: 3, superseded_by: null }),
      session({ id: "pcs_man_old", takeoff_kind: "manual", revision: 1, superseded_by: null }),
    ],
  });
  const svc = preconService(repo);
  const created = await svc.createManualSession("org_1", "usr_1", "prp_1", "pln_1", { fileName: "plan.pdf", storagePath: "org/plan.pdf" }, { kind: "full", elements: [] });
  assert.equal(created.takeoffKind, "manual");
  assert.equal(created.planId, "pln_1");
  assert.equal(got.sessions[0]?.status, "generating");
  assert.equal(got.sessions[0]?.revision, 2, "numbered after the last manual take-off, not the AI one");
  assert.deepEqual(got.superseded[0], ["pcs_man_old"], "only the earlier manual take-off is superseded");
  assert.deepEqual(got.bills.map((b) => b.title), [MANUAL_BILL_TITLE]);
  assert.equal(got.rows.length, 0);
  assert.equal(got.sheets.length, 1);
  assert.equal(got.sheets[0]?.kind, "unknown");
  assert.equal(got.sheets[0]?.status, "pending");
});

test("nextRevision keeps AI and manual lineages apart on the same plan and scope", async () => {
  const scope = { kind: "full" as const, elements: [] };
  const { repo } = fakeRepo({
    sessionsByPlan: async () => [
      session({ id: "ai_2", takeoff_kind: "pdf", revision: 2, superseded_by: null }),
      session({ id: "ai_1", takeoff_kind: "dwg", revision: 1, superseded_by: "ai_2" }),
      session({ id: "man_1", takeoff_kind: "manual", revision: 1, superseded_by: null }),
      session({ id: "other_scope", takeoff_kind: "manual", revision: 5, superseded_by: null, scope: { kind: "areas", elements: [] } }),
    ],
  });
  assert.deepEqual(await nextRevision(repo, "pln_1", scope, "ai"), { revision: 3, supersedes: ["ai_2"] });
  assert.deepEqual(await nextRevision(repo, "pln_1", scope, "manual"), { revision: 2, supersedes: ["man_1"] });
  assert.deepEqual(await nextRevision(repo, null, scope, "manual"), { revision: 1, supersedes: [] });
});

test("fillDwgSession in sheets-only mode lands the register with every drawing open and no rows", async () => {
  const { repo, got } = fakeRepo();
  const svc = preconService(repo);
  const handover: DwgTakeoffHandover = {
    units: { unit: "mm", scaleToMm: 1, errorPct: 0.02, note: "drawn in mm" },
    layerMap: {},
    sheets: [
      { id: 1, code: "DWG-01", title: "Ground floor", kind: "floor-plan", bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 }, levelMm: 0, multiplier: 1 },
      { id: 2, code: "DWG-02", title: "Front elevation", kind: "elevation", bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 }, levelMm: null, multiplier: 1 },
    ],
    items: [],
    notes: ["something the engine would have said"],
  };
  const result = await svc.fillDwgSession("pcs_1", { fileName: "plan.dwg" }, handover, { sheetsOnly: true });
  assert.equal(got.rows.length, 0, "no engine rows, not even notes");
  assert.equal(got.bills.length, 0, "the manual bill already exists; no DWG bill is added");
  assert.deepEqual(got.sheets.map((s) => s.status), ["measured", "measured"], "an elevation can be measured by hand");
  assert.deepEqual(got.sheets.map((s) => s.error), [null, null]);
  assert.equal(got.sheets[0]?.scale_mm_per_pt, 1);
  assert.deepEqual(got.sheetStatus, ["reviewing"]);
  assert.equal(result.status, "reviewing");
});
