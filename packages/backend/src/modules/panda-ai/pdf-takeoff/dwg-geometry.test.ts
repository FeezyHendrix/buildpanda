import { test } from "node:test";
import assert from "node:assert/strict";
import { preconService } from "./service.ts";
import { shapeFigure } from "./dwg-geometry.ts";
import type { PreconRepository } from "./repository.ts";
import type { DwgTakeoffHandover, PreconBoqRowRow, PreconGeometryRow, PreconSessionRow } from "./types.ts";

// A DWG run must annotate its sheets, not only cite handles: one geometry row
// per shape, sourced "ai", drawn on the sheet the line was measured on.

function sessionRow(): PreconSessionRow {
  return {
    id: "pcs_1",
    org_id: "org_1",
    project_id: null,
    proposal_id: "prp_1",
    status: "generating",
    title: "site.dwg",
    error: null,
    phase: null,
    progress_log: null,
    scope: { kind: "full", elements: [] },
    plan_id: "pln_1",
    takeoff_kind: "dwg",
    extraction: null,
    structure_context: null,
    programme_start_date: null,
    revision: 1,
    superseded_by: null,
    created_by: "usr_1",
    created_at: new Date(),
    updated_at: new Date(),
  } as PreconSessionRow;
}

interface Captured {
  rows: PreconBoqRowRow[];
  geometries: Omit<PreconGeometryRow, "created_at">[];
  sheets: { id: string; code: string }[];
  clearedAiGeometry: string[];
}

function fakeRepo(): { repo: PreconRepository; got: Captured } {
  const got: Captured = { rows: [], geometries: [], sheets: [], clearedAiGeometry: [] };
  const repo = {
    sessionById: async () => sessionRow(),
    sheetsBySession: async () => [{ storage_path: "org_1/site.dwg", file_name: "site.dwg" }],
    rowsBySession: async () => [],
    deleteRows: async () => 0,
    deleteAiGeometriesBySession: async (sessionId: string) => {
      got.clearedAiGeometry.push(sessionId);
      return 0;
    },
    deleteSheetsBySession: async () => 0,
    insertSheets: async (sheets: { id: string; code: string }[]) => {
      got.sheets.push(...sheets);
    },
    updateSessionLayerMap: async () => undefined,
    billsBySession: async () => [{ id: "pbl_1", session_id: "pcs_1", title: "Bill No. 1", sort: 0 }],
    insertBoqRows: async (rows: PreconBoqRowRow[]) => {
      got.rows.push(...rows);
    },
    insertGeometries: async (rows: Omit<PreconGeometryRow, "created_at">[]) => {
      got.geometries.push(...rows);
    },
    appendSessionProgress: async () => undefined,
    updateSessionStatus: async () => undefined,
  } as unknown as PreconRepository;
  return { repo, got };
}

const handover: DwgTakeoffHandover = {
  units: { unit: "mm", scaleToMm: 1, errorPct: 0.02, note: "drawn in mm" },
  layerMap: { WALL: "walls" },
  sheets: [
    { id: 7, code: "DWG-01", title: "Ground floor", kind: "floor-plan", bounds: { minX: 0, minY: 0, maxX: 12000, maxY: 8000 }, levelMm: 450, multiplier: 2 },
    { id: 9, code: "DWG-02", title: "North view", kind: "elevation", bounds: { minX: 20000, minY: 0, maxX: 32000, maxY: 7000 }, levelMm: null, multiplier: 1 },
  ],
  items: [
    {
      trade: "walls",
      description: "225mm blockwork",
      quantity: 60,
      unit: "m2",
      confidence: "high",
      basis: "paired faces",
      sheetId: 7,
      evidence: [101, 102],
      shapes: [
        { kind: "linear", vertices: [[0, 115], [10000, 115]] },
        { kind: "linear", vertices: [[6115, 230], [6115, 7770]] },
      ],
    },
    {
      trade: "floor areas",
      description: "BEDROOM — net floor area",
      quantity: 24,
      unit: "m2",
      confidence: "medium",
      basis: "flood fill",
      sheetId: 7,
      shapes: [{ kind: "area", vertices: [[0, 0], [6000, 0], [6000, 4000], [0, 4000]] }],
    },
    {
      trade: "columns",
      description: "Reinforced concrete columns",
      quantity: 4,
      unit: "nr",
      confidence: "high",
      basis: "column outlines",
      sheetId: 7,
      shapes: [{ kind: "count", vertices: [[150, 150], [11850, 150], [150, 7850], [11850, 7850]] }],
    },
    {
      trade: "windows",
      description: "Windows on North view",
      quantity: 8,
      unit: "nr",
      confidence: "low",
      basis: "frame groups",
      sheetId: 9,
      noteOnly: true,
      shapes: [{ kind: "count", vertices: [[21000, 1500], [23800, 1500]] }],
    },
  ],
  notes: [],
};

test("fillDwgSession writes one AI geometry per shape, on the sheet the line was measured on", async () => {
  const { repo, got } = fakeRepo();
  await preconService(repo).fillDwgSession("pcs_1", { fileName: "site.dwg" }, handover);

  assert.equal(got.geometries.length, 4, "two wall runs, one room and one column mark; the note draws nothing");
  assert.ok(got.geometries.every((g) => g.source === "ai"));
  const planSheetId = got.sheets.find((s) => s.code === "DWG-01")!.id;
  assert.ok(got.geometries.every((g) => g.sheet_id === planSheetId), "every shape lands on the plan it was measured on");

  // each geometry hangs off the row whose shape it is
  const rowById = new Map(got.rows.map((r) => [r.id, r]));
  for (const g of got.geometries) assert.ok(rowById.has(g.row_id), `geometry ${g.id} cites an unknown row`);
  const wallRow = got.rows.find((r) => r.description === "225mm blockwork")!;
  const wallShapes = got.geometries.filter((g) => g.row_id === wallRow.id);
  assert.equal(wallShapes.length, 2);
  assert.deepEqual(wallShapes.map((g) => g.kind), ["linear", "linear"]);
  // the figure recorded is the shape's own: metres of centreline, not the line's m²
  assert.deepEqual(wallShapes.map((g) => [g.quantity, g.unit]), [[10, "m"], [7.54, "m"]]);
  assert.deepEqual(wallShapes[0]?.vertices, [[0, 115], [10000, 115]], "vertices stay in drawing units");

  const room = got.geometries.find((g) => g.kind === "area")!;
  assert.equal(room.quantity, 24);
  assert.equal(room.unit, "m2");
  const columns = got.geometries.find((g) => g.kind === "count")!;
  assert.equal(columns.quantity, 4);
  assert.equal(columns.unit, "nr");

  // a note-only line is evidence for another line and draws nothing of its own
  const noteRow = got.rows.find((r) => r.row_type === "spec_note" && r.description.includes("North view"))!;
  assert.equal(got.geometries.filter((g) => g.row_id === noteRow.id).length, 0);
});

test("a re-run clears the engine's old annotations before drawing the sheet again", async () => {
  const { repo, got } = fakeRepo();
  await preconService(repo).fillDwgSession("pcs_1", { fileName: "site.dwg" }, handover);
  assert.deepEqual(got.clearedAiGeometry, ["pcs_1"], "the AI geometries go the way the AI rows do");
});

test("shapeFigure gives each shape its own base figure, and none without a scale", () => {
  assert.deepEqual(shapeFigure({ kind: "count", vertices: [[0, 0], [1, 1], [2, 2]] }, 1), { quantity: 3, unit: "nr" });
  assert.deepEqual(shapeFigure({ kind: "linear", vertices: [[0, 0], [3000, 0], [3000, 4000]] }, 1), { quantity: 7, unit: "m" });
  // a drawing in metres: the same polygon is a millionth of the millimetre one
  assert.deepEqual(shapeFigure({ kind: "area", vertices: [[0, 0], [4, 0], [4, 3], [0, 3]] }, 1000), { quantity: 12, unit: "m2" });
  assert.deepEqual(shapeFigure({ kind: "area", vertices: [[0, 0], [1, 0], [1, 1]] }, 0), { quantity: null, unit: null });
});
