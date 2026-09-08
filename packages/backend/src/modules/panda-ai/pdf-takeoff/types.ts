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
export const TAKEOFF_SCOPE_KINDS = ["full", "sections", "areas"] as const;
export type TakeoffScopeKind = (typeof TAKEOFF_SCOPE_KINDS)[number];

export interface TakeoffScope {
  kind: TakeoffScopeKind;
  elements: string[];
}

export const FULL_TAKEOFF_SCOPE: TakeoffScope = { kind: "full", elements: [] };
export const MEASURED_AREAS_GROUP = "Measured areas";

export const SHEET_KINDS = ["floor-plan", "elevation", "section", "detail", "schedule", "unknown"] as const;
export type SheetKind = (typeof SHEET_KINDS)[number];

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
  structure_context: StructureContext | null;
  programme_start_date: Date | string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
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
  qty: string | number | null;
  rate: string | number | null;
  amount: string | number | null;
  rate_source: string | null;
  confidence: Confidence | null;
  status: RowStatus | null;
  version: number;
  measurement_basis: string | null;
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
  structureContext: StructureContext | null;
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
  qty: number | null;
  rate: number | null;
  amount: number | null;
  rateSource: string | null;
  confidence: Confidence | null;
  status: RowStatus | null;
  version: number;
  measurementBasis: string | null;
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

export interface CreateSessionFromPlanBody {
  proposalId: string;
  planId: string;
  scope?: TakeoffScope;
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
  width: number;
  color: string;
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
