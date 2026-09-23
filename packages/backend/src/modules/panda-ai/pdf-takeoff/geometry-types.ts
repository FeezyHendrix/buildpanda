// Geometry: the shapes drawn on a sheet, the primitives behind them, and the
// quantities they measure. This is the leaf of the take-off type graph — it
// imports nothing from its siblings.

export const GEOMETRY_KINDS = ["area", "linear", "count", "deduction"] as const;
export type GeometryKind = (typeof GEOMETRY_KINDS)[number];

export const GEOMETRY_SOURCES = ["ai", "manual"] as const;
export type GeometrySource = (typeof GEOMETRY_SOURCES)[number];

export const DEDUCTION_MODES = ["area", "volume", "length", "count", "wall-opening"] as const;
export type DeductionMode = (typeof DEDUCTION_MODES)[number];

export interface Deduction {
  label: string;
  qty: number;
  geometryId: string | null;
  /** The unit the deducted figure is in. Null when it was never recorded. */
  unit: string | null;
  /** A person confirmed that unit matches the line it nets off; false means assumed. */
  unitConfirmed: boolean;
}

// Read-only projections of the opening's geometry definition, which owns them;
// never written back to `rows.deductions`. Absent, never assumed, on a legacy
// opening that recorded neither.
export interface DeductionDto extends Deduction {
  mode?: DeductionMode;
  dimensions?: { widthM?: number; heightM?: number; depthM?: number };
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
  // The measurement as it was MADE (tool, factor, scale, path). Deliberately
  // `unknown`: it is jsonb written by older code too, so it is parsed with
  // validateDefinitionV1 / resolveMeasureTool before anything trusts it.
  definition?: unknown;
  // A deduction names the measurement it is an opening in; ON DELETE RESTRICT.
  parent_geometry_id?: string | null;
  deleted_at?: Date | null;
  created_at: Date;
}

// ---------- the measurement as it was MADE ----------
//
// These are declarations only: the PARSE of them lives in editor-types.ts,
// which re-exports every name here so no importer had to move. They sit in the
// leaf because a geometry DTO has to be able to state its own definition, and a
// leaf that imported its parent to do so would be a type cycle.

/** The six measuring tools. Shares one list with the measurement engine. */
export type MeasurementTool = MeasureTool;

export interface LineSegment {
  kind: "line";
  end: [number, number];
}

/** A curved run: `mid` is a point on the arc, so three points fix it. */
export interface ArcSegment {
  kind: "arc";
  mid: [number, number];
  end: [number, number];
}

export type PathSegment = LineSegment | ArcSegment;

export type MeasurementShape =
  | { role: "path"; start: [number, number]; segments: PathSegment[]; closed: boolean }
  | { role: "points"; points: [number, number][] };

/** What lifts a drawn figure into its billed dimension: wall height, slab depth. */
export interface MeasurementFactor {
  heightM?: number;
  depthM?: number;
}

/**
 * Which scale produced the figure, and the sheet version it was true for. If
 * the sheet is re-calibrated its version moves on and the binding no longer
 * matches — the quantity is stale and must be re-confirmed, not quietly reused.
 */
export type ScaleBinding =
  | { source: "sheet"; sheetVersion: number; appliedMmPerPt: number }
  | { source: "viewport"; viewportId: string; sheetVersion: number; appliedMmPerPt: number };

/** The assembly as it stood when the line was drawn; later edits do not rewrite history. */
export interface AssemblySnapshot {
  assemblyId: string;
  assemblyName: string;
  factor: number;
  unit: string;
  description: string;
}

export interface MeasurementDefinitionV1 {
  schemaVersion: 1;
  role: "measurement";
  tool: MeasurementTool;
  shape: MeasurementShape;
  factor?: MeasurementFactor;
  scale?: ScaleBinding;
  assembly?: AssemblySnapshot;
}

/** An opening taken *out of* a parent measurement — never a free-standing shape. */
export interface DeductionDefinitionV1 {
  schemaVersion: 1;
  role: "deduction";
  parentGeometryId: string;
  mode: DeductionMode;
  shape?: MeasurementShape;
  dimensions?: { widthM?: number; heightM?: number; depthM?: number };
}

export type DefinitionV1 = MeasurementDefinitionV1 | DeductionDefinitionV1;

export interface PreconGeometry {
  id: string;
  rowId: string;
  sheetId: string;
  kind: GeometryKind;
  vertices: number[][];
  source: GeometrySource;
  quantity: number | null;
  unit: string | null;
  /**
   * How THIS drawing was measured — its own tool, factor, scale binding and
   * logical outline. Per drawing, because a line measured by two of them has two
   * answers and the row-level `measurementDefinition` can only carry one.
   * Null on a drawing that records none, and on one whose record cannot be read;
   * never a default, which would let the editor re-measure from a basis nobody
   * stated.
   */
  definition: DefinitionV1 | null;
  /** The drawing this is an opening in, or null when it is a measurement in its own right. */
  parentGeometryId: string | null;
}

export interface UpdateGeometryBody {
  version: number;
  kind: GeometryKind;
  vertices: number[][];
  // The logical outline, authoritative when present: its arcs are stored as
  // arcs and `vertices` is the tessellation the server derives from it.
  shape?: unknown;
  sheetId?: string;
  operationId?: string;
  // Which shape is being redrawn. A line can be measured by several, so without
  // this the server would have to pick one; it refuses instead.
  geometryId?: string;
  // How a legacy line that stored no definition was measured, as the QS states
  // it against the saved basis. Absent for every line that records its own.
  confirm?: DefinitionConfirmation;
}

/** The QS classifying an unclassified legacy measurement, never an inference. */
export interface DefinitionConfirmation {
  tool: MeasureTool;
  factor?: MeasureFactor;
  unit: string;
}

export interface MeasuredGeometry {
  kind: GeometryKind;
  vertices: number[][];
  quantity: number;
  unit: string;
  pageNumber?: number;
}

// The window of the DWG model space one register sheet occupies, in drawing units.
export interface SheetBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const MEASURE_TOOLS = ["length", "polyline", "area", "count", "volume", "wall_area"] as const;
export type MeasureTool = (typeof MEASURE_TOOLS)[number];

export interface MeasureFactor {
  heightM?: number;
  depthM?: number;
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

// A line's annotation on the drawing, in the drawing's own coordinates: the
// space the DWG engine measures in and the sheet's bounds frame.
export interface DwgTakeoffShape {
  kind: "linear" | "area" | "count";
  vertices: number[][];
}

// ---------- engine primitives (PDF extraction) ----------

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

// ---------- WS-M2A: viewports, on-demand sheet geometry ----------

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
