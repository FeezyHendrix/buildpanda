// The session and everything hung off it: the structure reading, the sheets,
// the extraction report, the bills, the summary and the programme of work.
import type { PreconBoqRow, PreconGeometry, PreconRowStatus } from "./precon-row-types";

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
  confidence: "high" | "low";
  signals: string[];
}

export type PreconSessionStatus = "uploading" | "generating" | "reviewing" | "output" | "failed";

export const PRECON_PHASES = ["reading", "structure", "schedules", "building", "pricing", "draft"] as const;
export type PreconPhase = (typeof PRECON_PHASES)[number];

export interface PreconProgressEntry {
  at: string;
  phase: PreconPhase;
  message: string;
}

export const TAKEOFF_SCOPE_KINDS = ["full", "sections", "areas", "materials", "early"] as const;
export type TakeoffScopeKind = (typeof TAKEOFF_SCOPE_KINDS)[number];

export interface TakeoffScope {
  kind: TakeoffScopeKind;
  elements: string[];
}

export const TAKEOFF_KINDS = ["pdf", "dwg", "manual", "early"] as const;
export type TakeoffKind = (typeof TAKEOFF_KINDS)[number];

/** Who draws the lines: the engine ("ai", the default) or a person ("manual"). */
export const TAKEOFF_MODES = ["ai", "manual"] as const;
export type TakeoffMode = (typeof TAKEOFF_MODES)[number];

export type PreconSheetKind = "floor-plan" | "roof-plan" | "elevation" | "section" | "detail" | "schedule" | "unknown";

// ---- extraction report (mirrors backend geometry/types.ts) ----
export type GeoUnit = "mm" | "cm" | "m" | "in" | "ft" | "unknown";
export interface GeoUnits {
  unit: GeoUnit;
  basis: "header" | "dimensions" | "text" | "assumed";
  confidence: number;
  note: string;
}
export interface ExtractionTotals {
  segments: number;
  shapes: number;
  arcs: number;
  inserts: number;
  texts: number;
  dimensions: number;
  all: number;
}
export interface ExtractionCoverage {
  measuredShare: number;
  measuredLayers: string[];
  ignoredLayers: string[];
}
export interface ExtractionDimensions {
  count: number;
  min: number | null;
  median: number | null;
  max: number | null;
}
export interface ExtractionReport {
  source: "dwg" | "pdf";
  units: GeoUnits;
  totals: ExtractionTotals;
  layers: { name: string; count: number; color: number | null; element: LayerElement; byType: Record<string, number> }[];
  blocks: { name: string; inserts: number; entities: number }[];
  dimensions: ExtractionDimensions;
  texts: { text: string; count: number }[];
  unreadable: { what: string; count: number; note: string }[];
  coverage: ExtractionCoverage;
  extents: { width: number; height: number } | null;
  warnings: string[];
}
export interface GeoSummary {
  source: "dwg" | "pdf";
  units: GeoUnits;
  totals: ExtractionTotals;
  coverage: ExtractionCoverage;
  topLayers: { name: string; count: number; element: LayerElement }[];
  dimensions: ExtractionDimensions;
  unreadable: number;
  warnings: string[];
}
export interface SessionExtraction {
  sheets: Record<string, ExtractionReport>;
  generatedAt: string;
}

export interface PreconSession {
  id: string;
  orgId: string;
  projectId: string | null;
  proposalId: string | null;
  status: PreconSessionStatus;
  title: string;
  error: string | null;
  phase: PreconPhase | null;
  progressLog: PreconProgressEntry[];
  scope: TakeoffScope;
  planId: string | null;
  takeoffKind: TakeoffKind;
  /** What the parser found per sheet, before anything was measured. */
  extraction: SessionExtraction | null;
  structureContext: StructureContext | null;
  /** DWG only: which element each layer holds, as proposed by the engine and corrected in review. */
  layerMap?: LayerMap | null;
  /** nth measurement of this drawing with this scope. */
  revision: number;
  /** Set when a later revision replaced this take-off; it stays readable. */
  supersededBy: string | null;
  /** Priced-line counts, present on the list endpoint. */
  lines?: { total: number; verified: number; attention: number };
  /** WS-M3B: the drawing this take-off measured has a newer revision; null when it is current. */
  stale?: { newerPlanId: string; newerRevision: string | null } | null;
  createdBy: string | null;
  createdAt: string;
}

export const LAYER_ELEMENTS = [
  "walls",
  "columns",
  "doors",
  "windows",
  "sanitary",
  "stairs",
  "roof",
  "furniture",
  "dimensions",
  "text",
  "grid",
  "levels",
  "ignore",
  "auto",
] as const;
export type LayerElement = (typeof LAYER_ELEMENTS)[number];
export type LayerMap = Record<string, LayerElement>;

/** The window of the DWG model space a register sheet occupies, in drawing units. */
export interface SheetBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** A window on a details sheet with its own scale; `rect` is [x1, y1, x2, y2] in sheet points. */
export interface SheetViewport {
  id: string;
  label: string;
  rect: [number, number, number, number];
  scaleMmPerPt: number;
}

export interface PreconSheet {
  id: string;
  sessionId: string;
  fileName: string;
  pageNumber: number;
  code: string | null;
  title: string | null;
  kind: PreconSheetKind;
  status: "pending" | "measured" | "unmeasurable";
  scaleMmPerPt: number | null;
  scaleConfidence: number | null;
  dimUnit: "mm" | "cm" | "m" | null;
  geoSummary: GeoSummary | null;
  bounds?: SheetBounds | null;
  error: string | null;
}

/** How the sheet's scale was last stated (contract 17). */
export interface SheetCalibration {
  enteredDistance?: number | null;
  unit?: string | null;
  mmPerPt: number;
  actor: string;
  time: string;
  fromPt?: [number, number];
  toPt?: [number, number];
}

export interface OverlayAnchorPair {
  source: [number, number];
  target: [number, number];
}

/** A persisted revision overlay alignment (contract 23). A view record, never a quantity. */
export interface OverlaySettingsV1 {
  schemaVersion: 1;
  sourceSheetId: string;
  targetSheetId: string;
  sourceRevisionId: string;
  targetRevisionId: string;
  opacity: number;
  anchors: [OverlayAnchorPair, OverlayAnchorPair, OverlayAnchorPair];
  /** CSS/DOMMatrix order a,b,c,d,e,f: tx = a·sx + c·sy + e ; ty = b·sx + d·sy + f. */
  matrix: [number, number, number, number, number, number];
  actor: string;
  time: string;
}

// Interface merging: the sheet DTO gains the M2 column without touching its
// declaration above (this file is append-only for streams).
export interface PreconSheet {
  viewports?: SheetViewport[] | null;
  version?: number;
  calibration?: SheetCalibration | null;
  overlaySettings?: OverlaySettingsV1 | null;
}

export interface UpdateSheetInput {
  kind?: PreconSheetKind;
  title?: string | null;
  scaleMmPerPt?: number | null;
  dimUnit?: "mm" | "cm" | "m" | null;
}

export type UpdateStructureInput = Partial<Omit<StructureContext, "signals" | "confidence">>;

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
  rows: PreconBoqRow[];
  geometries: PreconGeometry[];
  settings: PreconSummarySettings;
  summary: PreconSummary;
  progress: { total: number; verified: number };
}

// ── Programme of work ────────────────────────────────────────────────────────

export const PROGRAMME_DEPENDENCY_TYPES = ["FS", "SS", "FF", "SF"] as const;
export type ProgrammeDependencyType = (typeof PROGRAMME_DEPENDENCY_TYPES)[number];

export interface ProgrammeDependency {
  taskId: string;
  type: ProgrammeDependencyType;
  lagDays: number;
}

export const PROGRAMME_TASK_ORIGINS = ["ai", "manual", "prompt"] as const;
export type ProgrammeTaskOrigin = (typeof PROGRAMME_TASK_ORIGINS)[number];

/** As stored: durations and links, with no calendar attached — what the task mutations answer with. */
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
  confidence: "high" | "low" | null;
  status: PreconRowStatus;
  version: number;
  verifiedBy: string | null;
  verifiedAt: string | null;
  /** Working days the task can slip without moving the finish; from the scheduler's backward pass. */
  totalFloatDays: number | null;
  isCritical: boolean;
  origin: ProgrammeTaskOrigin;
}

/** Base plus the dates the server derives from the programme start date. */
export interface PreconProgrammeTask extends PreconProgrammeTaskBase {
  startAt: string;
  finishAt: string;
}

export interface PreconProgramme {
  sessionId: string;
  startDate: string;
  finishDate: string | null;
  tasks: PreconProgrammeTask[];
  progress: { total: number; verified: number };
}

export interface UpdateProgrammeTaskInput {
  version: number;
  name?: string;
  durationDays?: number;
  isMilestone?: boolean;
  basis?: string;
  outlineLevel?: number;
  /** Target position in the list; the server renumbers everything else. */
  sort?: number;
  predecessors?: ProgrammeDependency[];
}

export interface CreateProgrammeTaskInput {
  name: string;
  durationDays: number;
  isMilestone?: boolean;
  basis?: string;
  outlineLevel?: number;
  afterTaskId?: string;
  predecessors?: ProgrammeDependency[];
}
