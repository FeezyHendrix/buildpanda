// A take-off's sources, shaped the way the database hands them over.
//
// Rows carry their decimals as STRINGS, because `decimal(14,2)` comes back from
// pg as `"44.00"` and not `44`. Fixtures that used numbers would agree with the
// code for the wrong reason and hide every place a figure is compared without
// being normalised first.

import type { WorkbookSourceSet } from "./source.ts";
import type { PreconBillRow, PreconBoqRowRow, PreconGeometryRow, PreconSheetRow } from "../types.ts";

export interface RowSpec {
  readonly id: string;
  readonly billId?: string;
  readonly sort: number;
  readonly rowType?: PreconBoqRowRow["row_type"];
  readonly description?: string;
  readonly unit?: string | null;
  readonly qty?: string | null;
  readonly rate?: string | null;
  readonly amount?: string | null;
  readonly status?: PreconBoqRowRow["status"];
  readonly version?: number;
  readonly withdrawn?: boolean;
}

export function sourceRow(spec: RowSpec): PreconBoqRowRow {
  // `in`, not `??`: a spec that says `rate: null` means an UNPRICED line, and
  // `??` would quietly hand it the default rate instead — which is exactly the
  // case the undo tests are about.
  const or = <K extends keyof RowSpec>(key: K, fallback: RowSpec[K]): RowSpec[K] =>
    key in spec ? spec[key] : fallback;
  return {
    id: spec.id,
    bill_id: spec.billId ?? "bill-1",
    sort: spec.sort,
    row_type: spec.rowType ?? "item",
    element_group: null,
    code: `C${spec.sort}`,
    description: spec.description ?? `Line ${spec.sort}`,
    unit: or("unit", "m2") ?? null,
    qty_gross: or("qty", "10.00") ?? null,
    deductions: [],
    typical: 1,
    qty: or("qty", "10.00") ?? null,
    rate: or("rate", "100.00") ?? null,
    amount: or("amount", "1000.00") ?? null,
    rate_source: "ai",
    confidence: "high",
    status: spec.status ?? "ai_generated",
    version: spec.version ?? 1,
    measurement_basis: "Measured from drawing",
    confidence_reason: null,
    provenance: null,
    origin: "ai",
    edited_at: null,
    edited_by: null,
    verified_by: null,
    verified_at: null,
    deleted_at: spec.withdrawn === true ? new Date("2026-01-01T00:00:00Z") : null,
    measurement_settings: null,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
  };
}

export function sourceGeometry(id: string, rowId: string, withDefinition: boolean): PreconGeometryRow {
  return {
    id,
    row_id: rowId,
    sheet_id: "sheet-1",
    kind: "area",
    vertices: [
      [0, 0],
      [10, 0],
      [10, 10],
    ],
    source: "ai",
    quantity: "10.00",
    unit: "m2",
    definition: withDefinition ? { v: 1, tool: "area" } : null,
    parent_geometry_id: null,
    deleted_at: null,
    created_at: new Date("2026-01-01T00:00:00Z"),
  } as PreconGeometryRow;
}

export function sourceSheet(id = "sheet-1"): PreconSheetRow {
  return {
    id,
    session_id: "session-1",
    file_name: "plan.pdf",
    storage_path: `qa/${id}.pdf`,
    page_number: 1,
    code: "A-01",
    title: "Ground floor",
    kind: "floor-plan",
    status: "measured",
    scale_mm_per_pt: 50,
    scale_confidence: 1,
    dim_unit: "mm",
    snap_index: null,
    geo_summary: null,
    error: null,
    version: 1,
    calibration: null,
    overlay_settings: null,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
  } as PreconSheetRow;
}

export function sourceBill(id: string, title: string, sort = 0): PreconBillRow {
  return { id, session_id: "session-1", title, sort, created_at: new Date("2026-01-01T00:00:00Z") } as PreconBillRow;
}

export interface SourceSpec {
  readonly bills?: readonly PreconBillRow[];
  readonly rows?: readonly PreconBoqRowRow[];
  readonly geometries?: readonly PreconGeometryRow[];
  readonly revision?: number;
}

export function takeoffSource(spec: SourceSpec = {}): WorkbookSourceSet {
  return {
    sessionId: "session-1",
    revision: spec.revision ?? 1,
    bills: spec.bills ?? [sourceBill("bill-1", "Bill No. 1")],
    rows: spec.rows ?? [
      sourceRow({ id: "row-a", sort: 0, qty: "44.00", rate: "5000.00", amount: "220000.00" }),
      sourceRow({ id: "row-b", sort: 1, qty: "120.00", rate: "1200.00", amount: "144000.00" }),
    ],
    geometries: spec.geometries ?? [sourceGeometry("geo-a", "row-a", true)],
    sheets: [sourceSheet()],
  };
}
