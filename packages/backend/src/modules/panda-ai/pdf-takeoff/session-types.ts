import type { OverlaySettingsV1 } from "./editor-overlay.ts";
// The session and everything hung off it: sheets, bills, settings, summary and
// the snapshot the editor loads. Depends on geometry-types and row-types.
import type { GeoSummary, SessionExtraction } from "../geometry/types.ts";
import type { PreconGeometry, SheetBounds, SheetViewport } from "./geometry-types.ts";
import type { Confidence, PreconBoqRowDto, ReviewProgress } from "./row-types.ts";

export const SESSION_STATUSES = ["uploading", "generating", "reviewing", "output", "failed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

// The generate pipeline reports which stage it is in alongside every message,
// so the client renders a checklist from data instead of pattern-matching prose.
export const PRECON_PHASES = ["reading", "structure", "schedules", "building", "pricing", "draft"] as const;
export type PreconPhase = (typeof PRECON_PHASES)[number];

export interface PreconProgressEntry {
  at: string;
  phase: PreconPhase;
  message: string;
}

// What the run should produce. `full` is the whole bill; `sections` keeps only
// the named BESMM elements (a finishes-only bill, say); `areas` stops after
// measurement and lists the floor area of every identifiable space in m².
export const TAKEOFF_SCOPE_KINDS = ["full", "sections", "areas", "materials", "early"] as const;
export type TakeoffScopeKind = (typeof TAKEOFF_SCOPE_KINDS)[number];

export interface TakeoffScope {
  kind: TakeoffScopeKind;
  elements: string[];
}

export const FULL_TAKEOFF_SCOPE: TakeoffScope = { kind: "full", elements: [] };
export const MEASURED_AREAS_GROUP = "Measured areas";

// How the drawings reached the session: a PDF read by the engine, a DWG read by
// the automated take-off, a blank hand-priced sheet, or an early estimate.
export const TAKEOFF_KINDS = ["pdf", "dwg", "manual", "early"] as const;
export type TakeoffKind = (typeof TAKEOFF_KINDS)[number];

// "ai" runs the engine; "manual" renders the sheets and leaves the bill to
// the person drawing on them.
export const TAKEOFF_MODES = ["ai", "manual"] as const;
export type TakeoffMode = (typeof TAKEOFF_MODES)[number];

export const SHEET_KIND = {
  FLOOR_PLAN: "floor-plan",
  ROOF_PLAN: "roof-plan",
  ELEVATION: "elevation",
  SECTION: "section",
  DETAIL: "detail",
  SCHEDULE: "schedule",
  UNKNOWN: "unknown",
} as const;
export const SHEET_KINDS = [
  SHEET_KIND.FLOOR_PLAN,
  SHEET_KIND.ROOF_PLAN,
  SHEET_KIND.ELEVATION,
  SHEET_KIND.SECTION,
  SHEET_KIND.DETAIL,
  SHEET_KIND.SCHEDULE,
  SHEET_KIND.UNKNOWN,
] as const;
export type SheetKind = (typeof SHEET_KINDS)[number];

// Which element each DWG layer holds, as the engine proposed it and the reviewer corrected it.
export type SessionLayerMap = Record<string, string>;

export const SHEET_STATUSES = ["pending", "measured", "unmeasurable"] as const;
export type SheetStatus = (typeof SHEET_STATUSES)[number];

export const DIM_UNITS = ["mm", "cm", "m"] as const;
export type DimUnit = (typeof DIM_UNITS)[number];

export const STRUCTURE_CLASSES = ["building", "road", "bridge", "airport", "infrastructure", "unknown"] as const;
export type StructureClass = (typeof STRUCTURE_CLASSES)[number];

export const STRUCTURAL_SYSTEMS = ["load-bearing-masonry", "reinforced-concrete-frame", "steel-frame", "composite", "unknown"] as const;
export type StructuralSystem = (typeof STRUCTURAL_SYSTEMS)[number];

export const FOUNDATION_TYPES = ["strip", "raft", "pad", "pile", "unknown"] as const;
export type FoundationType = (typeof FOUNDATION_TYPES)[number];

export interface StructureContext {
  structureClass: StructureClass;
  buildingType: string | null;
  storeys: number | null;
  structuralSystem: StructuralSystem;
  foundationType: FoundationType;
  confidence: Confidence;
  signals: string[];
}

// A photo or scan of a drawing: Panda AI cannot measure it, a person can,
// after calibrating the scale from two points.
export const PICTURE_PLAN = /\.(png|jpe?g|webp)$/i;
export const PICTURE_CONTENT_TYPE: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

// ---------- rows (snake_case, DB) ----------

export interface PreconSessionRow {
  id: string;
  org_id: string;
  project_id: string | null;
  proposal_id: string | null;
  status: SessionStatus;
  title: string;
  error: string | null;
  phase: PreconPhase | null;
  progress_log: PreconProgressEntry[] | null;
  scope: TakeoffScope | null;
  plan_id: string | null;
  takeoff_kind: TakeoffKind;
  extraction: SessionExtraction | null;
  structure_context: StructureContext | null;
  programme_start_date: Date | string | null;
  layer_map?: SessionLayerMap | null;
  // nth measurement of this drawing with this scope; earlier ones point at the session that replaced them
  revision: number;
  superseded_by: string | null;
  // which re-run of the automated take-off is current; a result quoting an
  // older one is a straggler or a redelivery and is refused, not applied
  rerun_generation?: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SessionLineCounts {
  total: number;
  verified: number;
  attention: number;
}

/**
 * The scale a person set on a sheet, kept as a record of the act rather than
 * just its result: a quantity that moved because someone re-calibrated has to
 * name who did it and when, or the bill cannot be defended in a dispute.
 * `enteredDistance`/`unit` carry the real-world dimension typed against a drawn
 * line when the scale was set that way, and are null when it was typed outright.
 */
export interface SheetCalibration {
  enteredDistance?: number | null;
  unit?: string | null;
  mmPerPt: number;
  actor: string;
  time: string;
  // The two points the QS measured between. Kept so the basis of the scale is
  // auditable: "1:50" alone cannot be checked, a reference line can.
  fromPt?: [number, number];
  toPt?: [number, number];
}

export interface SheetCalibrationPatch {
  scaleMmPerPt: number | null;
  // Nullable because an undo genuinely restores a drawing to having recorded no
  // calibration at all. The type used to say otherwise and the undo path forced
  // a null through with a cast, which is the same lie written twice.
  calibration: SheetCalibration | null;
}

// The register fields a re-run rewrites onto an existing sheet. Deliberately
// no scale override of a person's calibration beyond what the engine re-read,
// and no id: the id is exactly what a restate exists to keep.
export type SheetRegisterPatch = Partial<
  Pick<
    PreconSheetRow,
    "file_name" | "storage_path" | "page_number" | "code" | "title" | "kind" | "status" | "scale_mm_per_pt" | "scale_confidence" | "dim_unit" | "bounds" | "error"
  >
>;

export interface PreconSheetRow {
  id: string;
  session_id: string;
  file_name: string;
  storage_path: string;
  page_number: number;
  code: string | null;
  title: string | null;
  kind: SheetKind;
  status: SheetStatus;
  scale_mm_per_pt: number | null;
  scale_confidence: number | null;
  dim_unit: DimUnit | null;
  snap_index: number[][] | null;
  geo_summary: GeoSummary | null;
  bounds?: SheetBounds | null;
  // a details sheet can carry several scales; null/absent means the sheet scale everywhere
  viewports?: SheetViewport[] | null;
  // bumped on re-calibration, so a measurement can pin the scale version it was true for
  version?: number;
  // what the last re-calibration recorded: the scale that was set, by whom, when
  calibration?: SheetCalibration | null;
  // how a previous revision is laid over this one; never affects a quantity
  overlay_settings?: OverlaySettingsV1 | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PreconBillRow {
  id: string;
  session_id: string;
  title: string;
  sort: number;
  created_at: Date;
}

export interface PreconSummarySettingsRow {
  session_id: string;
  prelims_pct: string | number;
  contingency_pct: string | number;
  vat_pct: string | number;
}

export interface PreconRateCardRow {
  id: string;
  org_id: string;
  name: string;
  region: string | null;
  currency: string;
  created_at: Date;
}

export interface PreconRateRow {
  id: string;
  rate_card_id: string;
  code_prefix: string | null;
  description_pattern: string | null;
  unit: string;
  rate: string | number;
  created_at: Date;
}

export interface PreconComplianceDocRow {
  id: string;
  org_id: string;
  file_name: string;
  storage_path: string;
  doc_type: string;
  expiry_date: Date | null;
  uploaded_by: string | null;
  created_at: Date;
}

// ---------- DTOs (camelCase, API) ----------

export interface PreconSession {
  id: string;
  orgId: string;
  projectId: string | null;
  proposalId: string | null;
  status: SessionStatus;
  title: string;
  error: string | null;
  phase: PreconPhase | null;
  progressLog: PreconProgressEntry[];
  scope: TakeoffScope;
  planId: string | null;
  takeoffKind: TakeoffKind;
  // what the parser found, per sheet, before measurement
  extraction: SessionExtraction | null;
  structureContext: StructureContext | null;
  layerMap?: SessionLayerMap | null;
  revision: number;
  supersededBy: string | null;
  // priced-line counts, filled on the list endpoint only
  lines?: SessionLineCounts;
  // the drawing has a newer revision (list and snapshot); null while it is current
  stale?: PreconSessionStale | null;
  createdBy: string | null;
  createdAt: string;
}

export interface PreconSheet {
  id: string;
  sessionId: string;
  fileName: string;
  pageNumber: number;
  code: string | null;
  title: string | null;
  kind: SheetKind;
  status: SheetStatus;
  scaleMmPerPt: number | null;
  scaleConfidence: number | null;
  dimUnit: DimUnit | null;
  geoSummary: GeoSummary | null;
  bounds: SheetBounds | null;
  viewports: SheetViewport[];
  // Every sheet-level write is checked against this. Exposed because the only
  // other way to learn it was to send a wrong one and read the number out of
  // the 409 prose, which made a correct first attempt impossible.
  version: number;
  calibration: SheetCalibration | null;
  overlaySettings: OverlaySettingsV1 | null;
  error: string | null;
}

export interface PreconBill {
  id: string;
  title: string;
  sort: number;
}

export interface PreconSummarySettings {
  prelimsPct: number;
  contingencyPct: number;
  vatPct: number;
}

export interface PreconSummary {
  measuredTotal: number;
  prelims: number;
  constructionSum: number;
  contingency: number;
  subTotal: number;
  vat: number;
  grandTotal: number;
}

export interface PreconSnapshot {
  session: PreconSession;
  sheets: PreconSheet[];
  bills: PreconBill[];
  rows: PreconBoqRowDto[];
  geometries: PreconGeometry[];
  settings: PreconSummarySettings;
  summary: PreconSummary;
  progress: ReviewProgress;
}

// The drawing this take-off measured has been superseded: the newest plan in
// the supersession chain, so the bill can say "re-measure on revision C".
export interface PreconSessionStale {
  newerPlanId: string;
  newerRevision: string | null;
}

export interface CalibrationResult {
  mmPerPt: number;
  confidence: number;
  dimUnit: DimUnit;
  matches: number;
}

export interface DrawingRegion {
  id: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  kind: SheetKind;
  segmentIdx: number[];
}

// ---------- DWG handover ----------




// Who has the session open, and which bill line each is on.
export interface PresenceUser {
  id: string;
  name: string;
  rowId: string | null;
}

export interface PresenceEvent {
  type: "precon.presence";
  users: PresenceUser[];
}
