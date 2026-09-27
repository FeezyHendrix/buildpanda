// Bill lines and what is drawn for them: the row, its geometry, the manual
// measurement bodies, assemblies, presence and the apply-to-estimate diff.
// This is the leaf of the take-off type graph — it imports no sibling.

export const PRECON_ROW_STATUSES = ["ai_generated", "needs_review", "verified", "rejected"] as const;
export type PreconRowStatus = (typeof PRECON_ROW_STATUSES)[number];

export const PRECON_GEOMETRY_KINDS = ["area", "linear", "count", "deduction"] as const;
export type PreconGeometryKind = (typeof PRECON_GEOMETRY_KINDS)[number];

export const ROW_ORIGINS = ["ai", "manual", "prompt", "migrated"] as const;
export type RowOrigin = (typeof ROW_ORIGINS)[number];

export const PRECON_ROW_TYPES = ["heading", "work_section", "spec_note", "item", "provisional_sum"] as const;
export type PreconRowType = (typeof PRECON_ROW_TYPES)[number];

export const PRECON_PRICED_ROW_TYPES: readonly PreconRowType[] = ["item", "provisional_sum"];

/** One side of a logical path: straight, or an arc through `mid` (a point ON the arc). */
export type PathSegment = { kind: "line"; end: [number, number] } | { kind: "arc"; mid: [number, number]; end: [number, number] };

/** The authoritative logical outline; the stored `vertices` are the server's tessellation of it. */
export type MeasurementShape =
  | { role: "path"; start: [number, number]; segments: PathSegment[]; closed: boolean }
  | { role: "points"; points: [number, number][] };

/** How a shape's scale was recorded (definition.scale). */
export type ScaleBinding =
  | { source: "sheet"; sheetVersion: number; appliedMmPerPt: number }
  | { source: "viewport"; viewportId: string; sheetVersion: number; appliedMmPerPt: number };

/** What the assembly recorded on one of its lines when the shape was drawn. */
export interface AssemblySnapshot {
  assemblyId: string;
  assemblyName: string;
  /** This line's quantity per unit of the drawn base quantity. */
  factor: number;
  unit: string;
  description: string;
}

/** The structured basis of a measured line, as `row.measurementDefinition` serves it. */
export interface MeasurementDefinitionV1 {
  schemaVersion: 1;
  role: "measurement";
  tool: string;
  shape: MeasurementShape;
  factor?: { heightM?: number; depthM?: number };
  scale?: ScaleBinding;
  /**
   * The assembly item this shape was drawn for, FROZEN at the moment it was
   * drawn. Each line an assembly produces carries its own copy, so editing one
   * line never reaches its siblings and a later change to the rate library
   * never restates any of them.
   */
  assembly?: AssemblySnapshot;
}

export interface PreconDeduction {
  label: string;
  qty: number;
  geometryId: string | null;
  /** How the opening was stated — supplied by the DTO for prefilled edits. */
  mode?: "area" | "volume" | "length" | "count" | "wall-opening";
  dimensions?: { widthM?: number; heightM?: number; depthM?: number };
  unit?: string | null;
  unitConfirmed?: boolean;
}

export interface PreconBoqRow {
  id: string;
  billId: string;
  sort: number;
  rowType: PreconRowType;
  elementGroup: string | null;
  code: string | null;
  description: string;
  unit: string | null;
  qtyGross: number | null;
  deductions: PreconDeduction[];
  qty: number | null;
  rate: number | null;
  amount: number | null;
  rateSource: string | null;
  confidence: "high" | "low" | null;
  status: PreconRowStatus | null;
  version: number;
  measurementBasis: string | null;
  confidenceReason: string | null;
  provenance: string | null;
  /** DWG entity handles the engine computed this line from. */
  evidence?: number[];
  origin: RowOrigin;
  editedAt: string | null;
  editedBy: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

// Interface merging: the row DTO gains the M2 column without touching its
// declaration above (this file is append-only for streams).
export interface PreconBoqRow {
  /** × identical floors or areas: net = (gross − deductions) × typical. */
  typical?: number;
  /** Structured measurement basis; null/absent = legacy line needing explicit confirmation before quantity edits. */
  measurementDefinition?: MeasurementDefinitionV1 | null;
  /** Named repetitions and stated quantities, now read back from the DTO. */
  measurementSettings?: { schemaVersion: 1; quantityMode: "measured" | "stated"; repeatLabels?: string[] } | null;
}

export interface PreconGeometry {
  id: string;
  rowId: string;
  sheetId: string;
  kind: PreconGeometryKind;
  vertices: number[][];
  source: "ai" | "manual";
  quantity: number | null;
  unit: string | null;
  /**
   * THIS drawing's own basis (tool, logical shape, factor, scale binding),
   * parsed per geometry — the row-level `measurementDefinition` is one
   * definition chosen by last-write-wins and mis-describes every other shape
   * on a multi-drawing line. Null on legacy records.
   */
  definition?: MeasurementDefinitionV1 | null;
  parentGeometryId?: string | null;
}

export interface UpdateRowInput {
  version: number;
  changes: { description?: string; qty?: number; rate?: number; unit?: string };
}

export interface CreateRowInput {
  rowType?: PreconRowType;
  description: string;
  elementGroup?: string;
  code?: string;
  unit?: string;
  qty?: number;
  rate?: number;
}

// ---- take-off → estimate (WS-3) ----

export type ApplyMode = "preview" | "apply";
export type ApplyChange = "added" | "changed" | "removed" | "unchanged";

export interface ApplyPreviewItem {
  groupLabel: string;
  description: string;
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
  written?: number;
}

// ---- task 24 · pinned apply (recovery-estimate-apply.md §3) ----

/** What the preview read from the take-off; echoed back verbatim on apply. */
export interface ApplySourcePin {
  sessionId: string;
  fingerprint: string;
  expectedRows: { id: string; version: number }[];
  rowCount: number;
}

/** What the preview read from the estimate; echoed back verbatim on apply. */
export interface ApplyTargetPin {
  estimateId: string;
  fingerprint: string;
  status: string;
  itemCount: number;
}

export interface ApplyReviewSummary {
  verified: number;
  needsReview: number;
  aiGenerated: number;
  unverifiedRowIds: string[];
}

/** The four REQUIRED pins; omitting any is a 400. No auto-apply exists. */
export interface ApplyPins {
  sourceFingerprint: string;
  targetFingerprint: string;
  expectedRows: { id: string; version: number }[];
  acknowledgedUnverifiedRowIds: string[];
}

// Interface merging: the preview/apply response gained the pin material.
export interface ApplyPreviewItem {
  reviewStatus?: "ai_generated" | "needs_review" | "verified" | "rejected" | null;
  rowVersion?: number;
}
export interface ApplyPreview {
  source?: ApplySourcePin;
  target?: ApplyTargetPin;
  review?: ApplyReviewSummary;
  applied?: boolean;
}

/** The 409 body's `details`: the REFRESHED state, so the dialog re-renders without a second round trip. */
export interface ApplyConflictDetails {
  reasons: string[];
  source?: ApplySourcePin;
  target?: ApplyTargetPin;
  review?: ApplyReviewSummary;
}

// ---- manual measurements (WS-M1B; body defined by WS-M1A in pdf-takeoff/types.ts) ----

export const MEASURE_TOOLS = ["length", "polyline", "area", "count", "volume", "wall_area"] as const;
export type MeasureTool = (typeof MEASURE_TOOLS)[number];

export interface CreateMeasurementBody {
  sheetId: string;
  tool: MeasureTool;
  /** Sheet points, the same space the viewer sends to `PUT /precon/rows/:rowId/geometry`. */
  vertices: number[][];
  description: string;
  elementGroup: string;
  code?: string;
  /** Defaults by tool: length/polyline m, area m2, count nr, volume m3, wall_area m2. */
  unit?: string;
  /** wall_area needs heightM, volume needs depthM. */
  factor?: { heightM?: number; depthM?: number };
  /** × identical floors or areas; stated in the basis. Default 1. */
  typical?: number;
  rate?: number;
}

export interface CreateMeasurementResult {
  row: PreconBoqRow;
  geometry: PreconGeometry;
}

export interface RoomAtResult {
  vertices: number[][];
  label: string | null;
  areaM2: number;
}

export interface SymbolMatchesResult {
  points: number[][];
  name: string | null;
  count: number;
}

// ---- WS-M3B · assemblies, presence and focus (endpoints built by WS-M3A) ----

/** One line an assembly puts in the bill per drawn quantity: qty = base × factor. */
export interface AssemblyItem {
  description: string;
  unit: string;
  factor: number;
  elementGroup: string;
  rateId: string | null;
  code: string | null;
}

/** An org-level recipe: draw one shape, get every line the trade prices with it. */
export interface Assembly {
  id: string;
  orgId: string;
  name: string;
  /** The unit the drawn base quantity is in (m, m2, nr…). */
  unit: string;
  elementGroup: string;
  items: AssemblyItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertAssemblyInput {
  name: string;
  unit: string;
  elementGroup: string;
  items: AssemblyItem[];
}

/** `CreateMeasurementBody` without the description: the assembly names each line. */
export type CreateAssemblyMeasurementBody = Omit<CreateMeasurementBody, "description"> & { assemblyId: string };

export interface CreateAssemblyMeasurementResult {
  rows: PreconBoqRow[];
  geometry: PreconGeometry;
}

/** Who is on the session right now and, if they have one selected, which bill row. */
export interface PresenceUser {
  id: string;
  name: string;
  rowId: string | null;
}
