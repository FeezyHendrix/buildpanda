// Test scaffolding for the editor's write paths: one sheet, two measured
// lines, and a locked context stood up entirely in memory.
//
// Shared rather than copied because the numbers ARE the claim. A wall run of
// 7 m at 2.7 m high is 18.9 m2 in every test that touches it; if one file
// quietly carried a 7.1 m run, two suites would disagree about the same
// drawing and neither would be wrong on its own terms.
//
// Imported only by the editor test files. It registers no tests and is
// unreachable from the server entrypoints, so it never reaches a bundle.

import { editorServiceWith, type WithEditorWrite } from "./editor-service.ts";
import type { EditorWriteContext, OperationWriteContext } from "./editor-unit-of-work.ts";
import type { PreconChangeEvent } from "./service.ts";
import { SHEET_KIND } from "./types.ts";
import type { Deduction, PreconBillRow, PreconBoqRowRow, PreconGeometryRow, PreconSheetRow } from "./types.ts";

/** 1 sheet unit = 1000 mm = 1 m, so every expected figure is exact. */
export const MM_PER_UNIT = 1000;
export const SESSION_ID = "pcs_editor";
export const AT = new Date("2026-01-01T00:00:00.000Z");

/** 3 m across then 4 m up: a 7 m run of wall. */
export const POLYLINE_PATH = [
  [0, 0],
  [3, 0],
  [3, 4],
];

/** A 6 m × 4 m rectangle: 24 m². */
export const AREA_RECT = [
  [0, 0],
  [6, 0],
  [6, 4],
  [0, 4],
];

/** A 2 m × 1 m window in the corner of the slab: 2 m². */
export const WINDOW_RECT = [
  [0, 0],
  [2, 0],
  [2, 1],
  [0, 1],
];

/** A 2 m × 2 m door at the far end: 4 m², sharing no area with the window. */
export const DOOR_RECT = [
  [4, 2],
  [6, 2],
  [6, 4],
  [4, 4],
];

export const WALL_HEIGHT_M = 2.7;
export const NEW_WALL_HEIGHT_M = 3;

const unused =
  (name: string) =>
  (): never => {
    throw new Error(`${name} must not be called by this operation`);
  };

/** Every dependency refuses by default, so a test only wires what its operation may touch. */
export function stubContext(events: PreconChangeEvent[]): OperationWriteContext {
  return {
    rows: {
      rowById: unused("rowById"),
      rowsBySession: unused("rowsBySession"),
      nextRowSort: unused("nextRowSort"),
      insertBoqRow: unused("insertBoqRow"),
      updateRowVersioned: unused("updateRowVersioned"),
      applyDerivedRecompute: unused("applyDerivedRecompute"),
      rowByIdIncludeDeleted: unused("rowByIdIncludeDeleted"),
      softDeleteRow: unused("softDeleteRow"),
      rowsByIds: unused("rowsByIds"),
      sessionIdForRow: unused("sessionIdForRow"),
    },
    geometries: {
      measurementGeometryForRow: unused("measurementGeometryForRow"),
      geometriesByRow: unused("geometriesByRow"),
      geometryById: unused("geometryById"),
      insertGeometries: unused("insertGeometries"),
      replaceRowGeometry: unused("replaceRowGeometry"),
      softDeleteGeometry: unused("softDeleteGeometry"),
      updateGeometryMeasurement: unused("updateGeometryMeasurement"),
      geometryByIdIncludeDeleted: unused("geometryByIdIncludeDeleted"),
      geometriesBySheet: unused("geometriesBySheet"),
      geometriesByRows: unused("geometriesByRows"),
      moveGeometryToRow: unused("moveGeometryToRow"),
      reparentGeometry: unused("reparentGeometry"),
      softDeleteGeometriesForRow: unused("softDeleteGeometriesForRow"),
      restoreGeometryState: unused("restoreGeometryState"),
    },
    sheets: {
      sheetById: unused("sheetById"),
      lockSheet: unused("lockSheet"),
      applyCalibration: unused("applyCalibration"),
      replaceViewports: unused("replaceViewports"),
      setOverlaySettings: unused("setOverlaySettings"),
    },
    sessions: { sessionById: unused("sessionById") },
    audits: { insertAuditEvent: async () => undefined },
    bills: {
      billById: unused("billById"),
      billsBySession: unused("billsBySession"),
      insertBill: unused("insertBill"),
    },
    editor: new Proxy({}, { get: (_t, name) => unused(String(name)) }) as OperationWriteContext["editor"],
    // No transaction in a pure-unit stub: any writer that reaches for one is
    // doing database work these tests deliberately do not stand up.
    trx: new Proxy({}, { get: (_t, name) => unused(`trx.${String(name)}`) }) as OperationWriteContext["trx"],
    emit: (event) => {
      events.push(event);
    },
  };
}

export const TEST_BILL: PreconBillRow = {
  id: "pbl_1",
  session_id: SESSION_ID,
  title: "Bill No. 1",
  sort: 0,
  created_at: AT,
};

export const TEST_SHEET: PreconSheetRow = {
  id: "pcsh_1",
  session_id: SESSION_ID,
  file_name: "GA-01.dwg",
  storage_path: "plans/GA-01.dwg",
  page_number: 1,
  code: "GA-01",
  title: "Ground floor",
  kind: SHEET_KIND.FLOOR_PLAN,
  status: "measured",
  scale_mm_per_pt: MM_PER_UNIT,
  scale_confidence: 1,
  dim_unit: null,
  snap_index: null,
  geo_summary: null,
  bounds: null,
  viewports: null,
  version: 1,
  error: null,
  created_at: AT,
  updated_at: AT,
};

const BASE_ROW: Omit<PreconBoqRowRow, "id" | "unit" | "qty_gross" | "qty" | "deductions" | "measurement_basis"> = {
  bill_id: TEST_BILL.id,
  sort: 0,
  row_type: "item",
  element_group: "External walls",
  // deliberately not an anchor code, so no derived recompute is triggered
  code: "F10/110",
  description: "Blockwork to external walls",
  typical: 1,
  rate: null,
  amount: null,
  rate_source: null,
  confidence: "high",
  status: "verified",
  version: 3,
  confidence_reason: null,
  provenance: null,
  origin: "manual",
  edited_at: null,
  edited_by: null,
  verified_by: "u_qs",
  verified_at: AT,
  created_at: AT,
  updated_at: AT,
};

export const WALL_ROW: PreconBoqRowRow = {
  ...BASE_ROW,
  id: "pbr_wall",
  unit: "m2",
  qty_gross: 18.9,
  qty: 18.9,
  deductions: [],
  measurement_basis: "7 m polyline on GA-01 × 2.7 m height = 18.9 m2",
};

export const WALL_GEOMETRY: PreconGeometryRow = {
  id: "pgeo_wall",
  row_id: WALL_ROW.id,
  sheet_id: TEST_SHEET.id,
  kind: "linear",
  vertices: POLYLINE_PATH,
  source: "manual",
  quantity: 18.9,
  unit: "m2",
  definition: {
    schemaVersion: 1,
    role: "measurement",
    tool: "wall_area",
    shape: { role: "points", points: POLYLINE_PATH },
    factor: { heightM: WALL_HEIGHT_M },
  },
  created_at: AT,
};

export const WINDOW: Deduction = { label: "Window W1", qty: 2, geometryId: "pgeo_win", unit: "m2", unitConfirmed: true };
export const DOOR: Deduction = { label: "Door D1", qty: 4, geometryId: "pgeo_door", unit: "m2", unitConfirmed: true };

/** 24 m² of slab with one 2 m² window cut out, repeated on 2 typical floors: 44 m². */
export const SLAB_ROW: PreconBoqRowRow = {
  ...BASE_ROW,
  id: "pbr_slab",
  code: "E10/100",
  description: "Slab soffit finish",
  unit: "m2",
  qty_gross: 24,
  qty: 44,
  typical: 2,
  deductions: [WINDOW],
  measurement_basis: "6 m × 4 m area on GA-01 × 2 typical floors = 44 m2",
};

export const SLAB_GEOMETRY: PreconGeometryRow = {
  id: "pgeo_slab",
  row_id: SLAB_ROW.id,
  sheet_id: TEST_SHEET.id,
  kind: "area",
  vertices: AREA_RECT,
  source: "manual",
  quantity: 24,
  unit: "m2",
  definition: { schemaVersion: 1, role: "measurement", tool: "area", shape: { role: "points", points: AREA_RECT } },
  created_at: AT,
};

export const deductionGeometry = (id: string, vertices: number[][]): PreconGeometryRow => ({
  ...SLAB_GEOMETRY,
  id,
  kind: "deduction",
  vertices,
  quantity: null,
});

export interface RowUnderEdit {
  events: PreconChangeEvent[];
  locked: string[];
  written: Record<string, unknown>[];
  context: OperationWriteContext;
}

/** The row as the table would hold it: the version check is real, and every patch is captured. */
export function rowUnderEdit(row: PreconBoqRowRow): RowUnderEdit {
  const events: PreconChangeEvent[] = [];
  const locked: string[] = [];
  const written: Record<string, unknown>[] = [];
  const context = stubContext(events);
  context.rows.rowById = async () => row;
  context.sheets.sheetById = async () => TEST_SHEET;
  context.rows.updateRowVersioned = async (_id, version, patch) => {
    written.push({ ...patch });
    return version === row.version ? { ...row, ...patch, version: version + 1 } : null;
  };
  return { events, locked, written, context };
}

const lockedWith =
  (context: EditorWriteContext, taken: string[]): WithEditorWrite =>
  (sessionId, callback) => {
    taken.push(sessionId);
    return callback(context);
  };

export const serviceFor = (r: RowUnderEdit) =>
  editorServiceWith(lockedWith(r.context, r.locked), async () => SESSION_ID);
