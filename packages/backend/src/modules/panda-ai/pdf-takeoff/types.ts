import type { GeoSummary, SessionExtraction } from "../geometry/types.ts";
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

// Who wrote a row: the engine, a person, a Panda AI prompt, or the migration.
export const ROW_ORIGINS = ["ai", "manual", "prompt", "migrated"] as const;
export type RowOrigin = (typeof ROW_ORIGINS)[number];

export const SHEET_KINDS = ["floor-plan", "elevation", "section", "detail", "schedule", "unknown"] as const;
export type SheetKind = (typeof SHEET_KINDS)[number];

// The window of the DWG model space one register sheet occupies, in drawing units.
export interface SheetBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Which element each DWG layer holds, as the engine proposed it and the reviewer corrected it.
export type SessionLayerMap = Record<string, string>;

export const SHEET_STATUSES = ["pending", "measured", "unmeasurable"] as const;
export type SheetStatus = (typeof SHEET_STATUSES)[number];

export const DIM_UNITS = ["mm", "cm", "m"] as const;
export type DimUnit = (typeof DIM_UNITS)[number];

export const ROW_TYPES = ["heading", "work_section", "spec_note", "item", "provisional_sum"] as const;
export type RowType = (typeof ROW_TYPES)[number];

export const ROW_STATUSES = ["ai_generated", "needs_review", "verified", "rejected"] as const;
export type RowStatus = (typeof ROW_STATUSES)[number];

export const CONFIDENCES = ["high", "low"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const GEOMETRY_KINDS = ["area", "linear", "count", "deduction"] as const;
export type GeometryKind = (typeof GEOMETRY_KINDS)[number];

export const GEOMETRY_SOURCES = ["ai", "manual"] as const;
export type GeometrySource = (typeof GEOMETRY_SOURCES)[number];

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
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SessionLineCounts {
  total: number;
  verified: number;
  attention: number;
}

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

export interface Deduction {
  label: string;
  qty: number;
  geometryId: string | null;
}

export interface PreconBoqRowRow {
  id: string;
  bill_id: string;
  sort: number;
  row_type: RowType;
  element_group: string | null;
  code: string | null;
  description: string;
  unit: string | null;
  qty_gross: string | number | null;
  deductions: Deduction[];
  // × identical floors/areas: net = (qty_gross − Σdeductions) × typical. Optional
  // on the row so engine inserts take the column default of 1.
  typical?: number;
  qty: string | number | null;
  rate: string | number | null;
  amount: string | number | null;
  rate_source: string | null;
  confidence: Confidence | null;
  status: RowStatus | null;
  version: number;
  measurement_basis: string | null;
  confidence_reason: string | null;
  provenance: string | null;
  // DWG entity handles the engine computed this line from
  evidence?: number[] | null;
  origin: RowOrigin;
  edited_at: Date | null;
  edited_by: string | null;
  verified_by: string | null;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PreconGeometryRow {
  id: string;
  row_id: string;
  sheet_id: string;
  kind: GeometryKind;
  vertices: number[][];
  source: GeometrySource;
  quantity: string | number | null;
  unit: string | null;
  created_at: Date;
}

export interface PreconAuditEventRow {
  id: string;
  session_id: string;
  row_id: string | null;
  actor: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
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
  error: string | null;
}

export interface PreconBill {
  id: string;
  title: string;
  sort: number;
}

export interface PreconBoqRowDto {
  id: string;
  billId: string;
  sort: number;
  rowType: RowType;
  elementGroup: string | null;
  code: string | null;
  description: string;
  unit: string | null;
  qtyGross: number | null;
  deductions: Deduction[];
  typical: number;
  qty: number | null;
  rate: number | null;
  amount: number | null;
  rateSource: string | null;
  confidence: Confidence | null;
  status: RowStatus | null;
  version: number;
  measurementBasis: string | null;
  confidenceReason: string | null;
  provenance: string | null;
  evidence?: number[];
  origin: RowOrigin;
  editedAt: string | null;
  editedBy: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export interface PreconGeometry {
  id: string;
  rowId: string;
  sheetId: string;
  kind: GeometryKind;
  vertices: number[][];
  source: GeometrySource;
  quantity: number | null;
  unit: string | null;
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

export interface ReviewProgress {
  total: number;
  verified: number;
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

// ---------- request bodies ----------

export interface UpdateRowBody {
  version: number;
  changes: {
    description?: string;
    qty?: number;
    rate?: number;
    unit?: string;
    // integer ≥ 1; qty is recomputed from qty_gross, deductions and this
    typical?: number;
  };
}

export interface UpdateGeometryBody {
  version: number;
  kind: GeometryKind;
  vertices: number[][];
  sheetId?: string;
}

export interface AddDeductionBody {
  version: number;
  label: string;
  vertices: number[][];
  sheetId?: string;
}

export interface CreateBlankSessionBody {
  title: string;
  proposalId?: string;
}

// Take-off → estimate. Preview is a diff; apply writes the same list.
export const APPLY_MODES = ["preview", "apply"] as const;
export type ApplyMode = (typeof APPLY_MODES)[number];

export interface ApplyToEstimateBody {
  estimateId: string;
  mode: ApplyMode;
}

export type ApplyChange = "added" | "changed" | "removed" | "unchanged";

export interface ApplyPreviewItem {
  groupLabel: string;
  description: string;
  descriptionHtml?: string | null;
  qty: number;
  unit: string;
  unitRate: number;
  boqItemId: string | null;
  takeoffSessionId: string | null;
  change: ApplyChange;
  previous?: { qty: number; unit: string; description: string };
}

export interface ApplyPreview {
  added: number;
  changed: number;
  removed: number;
  unchanged: number;
  items: ApplyPreviewItem[];
}

// "ai" runs the engine; "manual" renders the sheets and leaves the bill to
// the person drawing on them.
export const TAKEOFF_MODES = ["ai", "manual"] as const;
export type TakeoffMode = (typeof TAKEOFF_MODES)[number];

export interface CreateSessionFromPlanBody {
  proposalId: string;
  planId: string;
  scope?: TakeoffScope;
  mode?: TakeoffMode;
}

export interface UpdateSheetBody {
  kind?: SheetKind;
  title?: string | null;
  scaleMmPerPt?: number | null;
  dimUnit?: DimUnit | null;
  // replaces the sheet's viewports; an id is kept when given, minted when not
  viewports?: SheetViewportInput[];
}

export type UpdateStructureBody = Partial<Omit<StructureContext, "signals" | "confidence">>;

export interface UpdateLayerMapBody {
  layerMap: SessionLayerMap;
}

// Rows a DWG take-off hands over; the session stores them like any AI draft.
// A line's annotation on the drawing, in the drawing's own coordinates: the
// space the DWG engine measures in and the sheet's bounds frame.
export interface DwgTakeoffShape {
  kind: "linear" | "area" | "count";
  vertices: number[][];
}

export interface DwgTakeoffLine {
  trade: string;
  description: string;
  quantity: number;
  unit: string;
  confidence: "high" | "medium" | "low";
  basis: string;
  // the register sheet the line was measured on, and what checked it
  sheetId?: number;
  evidence?: number[];
  shapes?: DwgTakeoffShape[];
  reason?: string;
  crossCheck?: string;
  // evidence for another line (an elevation's window count); lands as an unpriced note
  noteOnly?: boolean;
}

// One drawing of the DWG register, as the engine hands it to the session.
export interface DwgRegisterSheet {
  id: number;
  code: string;
  title: string;
  kind: string;
  bounds: SheetBounds;
  levelMm: number | null;
  multiplier: number;
}

// Everything the DWG engine hands the session: units, register, layer map, lines, notes.
export interface DwgTakeoffHandover {
  units: { unit: string; scaleToMm: number; errorPct: number; note: string };
  layerMap: SessionLayerMap;
  sheets: DwgRegisterSheet[];
  items: DwgTakeoffLine[];
  notes: string[];
}

export interface CreateBillBody {
  title: string;
}

export interface UpdateBillBody {
  title: string;
}

// qty/rate are rejected on non-priced row types, matching the updateRow rule.
export interface CreateRowBody {
  rowType?: RowType;
  description: string;
  elementGroup?: string;
  code?: string;
  unit?: string;
  qty?: number;
  rate?: number;
}

// ---------- engine types ----------

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  len: number;
  // pen width in page points, already scaled by the transform it was drawn under
  width: number;
  color: string;
  // painted with a fill operator (a hatch or solid outline) rather than stroked
  fill?: boolean;
  // optional-content group the path sat in: the CAD layer that survived export
  layer?: string | null;
  // subpath id and whether that subpath was closed, so outlines can be rebuilt
  path?: number;
  closed?: boolean;
}

export interface Curve {
  sx: number;
  sy: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  ex: number;
  ey: number;
  width: number;
  color: string;
}

export interface TextRun {
  str: string;
  x: number;
  y: number;
  w: number;
  rotated: boolean;
}

export interface ExtractedSheet {
  segments: Segment[];
  curves: Curve[];
  texts: TextRun[];
  // embedded images: a scanned plan placed on a sheet is pixels the vector engine cannot measure
  images?: { count: number; areaPt2: number; pageShare: number | null };
  // the raw pdf.js operator list, kept so the extraction report can recover
  // fills, scaled line widths and optional-content layers without a re-parse
  ops?: { fnArray: number[]; argsArray: unknown[] };
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

export interface MeasuredGeometry {
  kind: GeometryKind;
  vertices: number[][];
  quantity: number;
  unit: string;
  pageNumber?: number;
}

export const ITEM_SCOPES = ["per-floor", "whole-building"] as const;
export type ItemScope = (typeof ITEM_SCOPES)[number];

export interface MeasuredBoqItem {
  elementGroup: string;
  workSection: { code: string; title: string };
  specNote: string | null;
  groupHeading?: string | null;
  code: string | null;
  description: string;
  unit: string;
  qtyGross: number;
  deductions: { label: string; qty: number }[];
  qty: number;
  confidence: Confidence;
  measurementBasis: string;
  geometries: MeasuredGeometry[];
  pageNumber: number;
  scope?: ItemScope;
  provisional?: boolean;
  // why the engine doubted this line, in the reviewer's words ("scale", "vision", ...)
  confidenceReason?: string | null;
}

// ── Programme of work ────────────────────────────────────────────────────────

export const PROGRAMME_DEPENDENCY_TYPES = ["FS", "SS", "FF", "SF"] as const;
export type ProgrammeDependencyType = (typeof PROGRAMME_DEPENDENCY_TYPES)[number];

export interface ProgrammeDependency {
  taskId: string;
  type: ProgrammeDependencyType;
  lagDays: number;
}

// Who last shaped a task: the drafter, a person in the editor, or a person
// through a Panda AI prompt. Drives the "AI draft vs edited" presentation.
export const PROGRAMME_TASK_ORIGINS = ["ai", "manual", "prompt"] as const;
export type ProgrammeTaskOrigin = (typeof PROGRAMME_TASK_ORIGINS)[number];

export interface PreconProgrammeTaskRow {
  id: string;
  session_id: string;
  sort: number;
  name: string;
  element_group: string | null;
  wbs_code: string | null;
  outline_level: number;
  parent_task_id: string | null;
  duration_days: string | number;
  predecessors: ProgrammeDependency[] | string;
  is_milestone: boolean;
  basis: string | null;
  confidence: Confidence | null;
  status: RowStatus;
  version: number;
  verified_by: string | null;
  verified_at: Date | string | null;
  total_float_days: number | null;
  is_critical: boolean;
  origin: ProgrammeTaskOrigin;
  created_at: Date | string;
  updated_at: Date | string;
}

/** As stored: durations and links, with no calendar attached. */
export interface PreconProgrammeTaskBase {
  id: string;
  sessionId: string;
  sort: number;
  name: string;
  elementGroup: string | null;
  wbsCode: string | null;
  outlineLevel: number;
  parentTaskId: string | null;
  durationDays: number;
  predecessors: ProgrammeDependency[];
  isMilestone: boolean;
  basis: string | null;
  confidence: Confidence | null;
  status: RowStatus;
  version: number;
  verifiedBy: string | null;
  verifiedAt: string | null;
  totalFloatDays: number | null;
  isCritical: boolean;
  origin: ProgrammeTaskOrigin;
}

/** Base plus the dates resolved by the forward pass in programme-schedule.ts. */
export interface PreconProgrammeTask extends PreconProgrammeTaskBase {
  startAt: string;
  finishAt: string;
}

export interface PreconProgramme {
  sessionId: string;
  startDate: string;
  finishDate: string | null;
  tasks: PreconProgrammeTask[];
  progress: ReviewProgress;
}

export interface UpdateProgrammeTaskBody {
  version: number;
  name?: string;
  durationDays?: number;
  isMilestone?: boolean;
  basis?: string;
  outlineLevel?: number;
  sort?: number;
  predecessors?: ProgrammeDependency[];
}

export interface CreateProgrammeTaskBody {
  name: string;
  durationDays: number;
  isMilestone?: boolean;
  basis?: string;
  outlineLevel?: number;
  /** Insert directly after this task; omitted appends at the end. */
  afterTaskId?: string;
  predecessors?: ProgrammeDependency[];
}

// ── Manual take-off (measured by hand) ───────────────────────────────────────

// A photo or scan of a drawing: Panda AI cannot measure it, a person can,
// after calibrating the scale from two points.
export const PICTURE_PLAN = /\.(png|jpe?g|webp)$/i;
export const PICTURE_CONTENT_TYPE: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

export const MEASURE_TOOLS = ["length", "polyline", "area", "count", "volume", "wall_area"] as const;
export type MeasureTool = (typeof MEASURE_TOOLS)[number];

export interface MeasureFactor {
  heightM?: number;
  depthM?: number;
}

// A line a person drew on a sheet. Vertices are sheet points, the same space
// PreconGeometry.vertices uses; the sheet's scale turns them into metres.
export interface CreateMeasurementBody {
  sheetId: string;
  tool: MeasureTool;
  vertices: number[][];
  description: string;
  elementGroup: string;
  code?: string;
  // defaults by tool: length/polyline m, area m2, count nr, volume m3, wall_area m2
  unit?: string;
  // wall_area needs heightM, volume needs depthM
  factor?: MeasureFactor;
  // × identical floors/areas, default 1, stated in the basis
  typical?: number;
  rate?: number;
  // the bill the line lands in; defaults to the session's first bill
  billId?: string;
}

// A quantity stated rather than drawn ("add 12 m of 225 wall"): a plain manual
// row whose basis says so. Used by the Panda AI assist path.
export interface StatedMeasurementBody {
  tool: MeasureTool;
  qty: number;
  description: string;
  elementGroup: string;
  code?: string;
  unit?: string;
  factor?: MeasureFactor;
  typical?: number;
  rate?: number;
  sheetId?: string;
  billId?: string;
}

export interface CreateMeasurementResult {
  row: PreconBoqRowDto;
  geometry: PreconGeometry;
}

// What the geometry maths produces before it becomes a bill row.
export interface ManualQuantity {
  // the drawn figure in its natural unit: metres, m2 or a count
  base: number;
  baseUnit: string;
  // after the tool's factor (height, depth) but before typical
  gross: number;
  unit: string;
  geometryKind: GeometryKind;
}

// ---------- WS-M2A: typical, viewports, on-demand sheet geometry ----------

// A region of a details sheet drawn at its own scale. `rect` is in sheet
// points; a measurement whose first vertex falls inside uses this scale.
export interface SheetViewport {
  id: string;
  label: string;
  rect: [number, number, number, number];
  scaleMmPerPt: number;
}

export type SheetViewportInput = Omit<SheetViewport, "id"> & { id?: string };

// Which scale a drawing at a point resolves to, and where it came from.
export interface ScalePick {
  mmPerPt: number;
  viewport: SheetViewport | null;
}

export interface RoomAtBody {
  x: number;
  y: number;
}

export interface RoomAtResult {
  // the enclosed region's outline in sheet points
  vertices: number[][];
  // the room label found inside it, if any
  label: string | null;
  areaM2: number;
}

export interface SymbolMatchesBody {
  rect: [number, number, number, number];
  // leave out the symbol(s) inside the seed rect from the result
  excludeSeed?: boolean;
}

export interface SymbolMatchesResult {
  // centroids of every match, in sheet points
  points: number[][];
  // the DWG block name, or null for a PDF outline signature
  name: string | null;
  count: number;
}

// The vector primitives behind a sheet, in sheet points, cached on disk per
// sheet and loaded on demand for room fill and symbol search.
export interface GeoSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  // pen width in sheet points (0 on a DWG, where the pen says nothing)
  width: number;
  // on a DWG: what the layer holds (walls, doors, furniture…), from the layer map
  element?: string;
}

export interface GeoText {
  str: string;
  // anchor (left baseline) and an estimated width
  x: number;
  y: number;
  w: number;
}

export interface GeoInsert {
  handle: number;
  name: string;
  x: number;
  y: number;
}

export interface GeoOutline {
  vertices: number[][];
}

export interface SheetGeometry {
  kind: "dwg" | "pdf";
  segments: GeoSegment[];
  texts: GeoText[];
  inserts: GeoInsert[];
  outlines: GeoOutline[];
  bounds: SheetBounds | null;
}

// ---- WS-M3A: assemblies, stale drawings, presence ----

// The drawing this take-off measured has been superseded: the newest plan in
// the supersession chain, so the bill can say "re-measure on revision C".
export interface PreconSessionStale {
  newerPlanId: string;
  newerRevision: string | null;
}

// One drawn shape billed as every item of an assembly; descriptions, units,
// element groups and rates come from the assembly's items, the rest from the
// drawing. `elementGroup` and `rate` are fallbacks for items that carry none.
export interface CreateAssemblyMeasurementBody extends Omit<CreateMeasurementBody, "description" | "elementGroup" | "unit"> {
  assemblyId: string;
  elementGroup?: string;
}

export interface AssemblyMeasurementResult {
  rows: PreconBoqRowDto[];
  // the first line's shape; every line carries a copy of the same vertices
  geometry: PreconGeometry;
  geometries: PreconGeometry[];
}

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
