// Shared in-memory fixtures for the take-off editor's pure regression suites.
//
// Extracted verbatim when editor-regression.test.ts passed the house 400-line
// ceiling. These are plain records and a fake unit-of-work context: no database,
// no HTTP. The suites that use them are editor-measurement-maths,
// editor-locked-writes and editor-restructure-rerun.

import type { EditorWriteContext } from "./editor-unit-of-work.ts";
import type { WithEditorWrite } from "./editor-service.ts";
import { SHEET_KIND } from "./types.ts";
import type { PreconBillRow, PreconBoqRowRow, PreconGeometryRow, PreconSheetRow } from "./types.ts";
import type { PreconChangeEvent } from "./service.ts";

export const MM_PER_UNIT = 1000;
export const WALL_HEIGHT_M = 2.7;
export const SLAB_DEPTH_M = 0.15;

/** [(0,0),(3,0),(3,4)] = 7 m of run at 1000 mm per unit. */
export const POLYLINE_PATH = [
  [0, 0],
  [3, 0],
  [3, 4],
];

/** 6 × 4 = 24 m2. */
export const AREA_RECT = [
  [0, 0],
  [6, 0],
  [6, 4],
  [0, 4],
];

export const SESSION_ID = "pcs_editor";
export const AT = new Date("2026-01-01T00:00:00.000Z");

/** 12.4 m of wall in a straight run. */
export const WALL_RUN = [
  [0, 0],
  [12.4, 0],
];

export const unused =
  (name: string) =>
  (): never => {
    throw new Error(`${name} must not be called by this operation`);
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

export const TEST_BILL: PreconBillRow = {
  id: "pbl_1",
  session_id: SESSION_ID,
  title: "Bill No. 1 — Measured by hand",
  sort: 0,
  created_at: AT,
};

export const WALL_ROW: PreconBoqRowRow = {
  id: "pbr_wall",
  bill_id: TEST_BILL.id,
  sort: 0,
  row_type: "item",
  element_group: "External walls",
  // deliberately not an anchor code, so no derived recompute is triggered
  code: "F10/110",
  description: "Blockwork to external walls",
  unit: "m2",
  qty_gross: 18.9,
  deductions: [],
  typical: 1,
  qty: 18.9,
  rate: null,
  amount: null,
  rate_source: null,
  confidence: "high",
  status: "verified",
  version: 3,
  measurement_basis: "7 m polyline on GA-01 × 2.7 m height = 18.9 m2",
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

export const WALL_GEOMETRY: PreconGeometryRow = {
  id: "pgeo_wall",
  row_id: WALL_ROW.id,
  sheet_id: TEST_SHEET.id,
  kind: "linear",
  vertices: POLYLINE_PATH,
  source: "manual",
  quantity: 7,
  unit: "m",
  definition: {
    schemaVersion: 1,
    role: "measurement",
    tool: "wall_area",
    shape: { role: "points", points: WALL_RUN },
    factor: { heightM: WALL_HEIGHT_M },
  },
  created_at: AT,
};

export function emptyContext(events: PreconChangeEvent[]): EditorWriteContext {
  return {
    rows: {
      rowById: unused("rowById"),
      rowsBySession: unused("rowsBySession"),
      nextRowSort: unused("nextRowSort"),
      insertBoqRow: unused("insertBoqRow"),
      updateRowVersioned: unused("updateRowVersioned"),
      applyDerivedRecompute: unused("applyDerivedRecompute"),
    },
    geometries: {
      measurementGeometryForRow: unused("measurementGeometryForRow"),
      geometriesByRow: unused("geometriesByRow"),
      geometryById: unused("geometryById"),
      insertGeometries: unused("insertGeometries"),
      replaceRowGeometry: unused("replaceRowGeometry"),
      softDeleteGeometry: unused("softDeleteGeometry"),
      updateGeometryMeasurement: unused("updateGeometryMeasurement"),
    },
    sheets: { sheetById: unused("sheetById") },
    audits: { insertAuditEvent: async () => undefined },
    bills: {
      billById: unused("billById"),
      billsBySession: unused("billsBySession"),
      insertBill: unused("insertBill"),
    },
    emit: (event) => {
      events.push(event);
    },
  };
}

/** Runs the callback against the given context, the way a committed lock would. */
export const lockedWith =
  (context: EditorWriteContext, taken: string[]): WithEditorWrite =>
  (sessionId, callback) => {
    taken.push(sessionId);
    return callback(context);
  };
