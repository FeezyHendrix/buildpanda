import type { DeductionMode } from "./editor-types.ts";
// Request bodies the take-off routes accept, and the apply-to-estimate diff
// they answer with. The JSON schemas that validate these live next to the
// routes; this file is the TypeScript side of the same contract.
import type { MeasureFactor, MeasureTool, SheetViewport, SheetViewportInput } from "./geometry-types.ts";
import type { RowType } from "./row-types.ts";
import type { DimUnit, SessionLayerMap, SheetKind, StructureContext, TakeoffMode, TakeoffScope } from "./session-types.ts";

export interface UpdateRowBody {
  version: number;
  changes: {
    description?: string;
    qty?: number;
    // `null` clears the rate. The route schemas do not accept it; only an
    // undo does, putting back a line that carried no rate before the edit.
    rate?: number | null;
    unit?: string;
    // integer ≥ 1; qty is recomputed from qty_gross, deductions and this
    typical?: number;
  };
}

// Deliberately a superset of UpdateRowBody["changes"]: a geometry save also
// restates the factor a drawn shape is billed through, and a changed height or
// depth is a changed basis even when the vertices are identical.
export interface ReviewRelevantChanges {
  description?: string;
  qty?: number;
  rate?: number;
  unit?: string;
  typical?: number;
  factor?: MeasureFactor;
}

export interface AddDeductionBody {
  version: number;
  label: string;
  // Drawn OR stated: a wall opening is a width x height off an elevation, and
  // the plan only shows its footprint.
  vertices?: number[][];
  mode?: DeductionMode;
  dimensions?: { widthM?: number; heightM?: number; depthM?: number };
  sheetId?: string;
  operationId?: string;
}

/**
 * The edits that restate a measured line without redrawing it. `operationId`
 * is optional and carries the same meaning as on `ReverseOperationBody`: a
 * retried save is recorded once, and the entry stays addressable by an undo.
 */
export interface RemoveDeductionBody {
  version: number;
  operationId?: string;
}

/** Only the shape moves; the deduction keeps its id, its label and its place on the line. */
export interface EditDeductionBody {
  version: number;
  mode?: DeductionMode;
  vertices?: number[][];
  dimensions?: { widthM?: number; heightM?: number; depthM?: number };
  operationId?: string;
}

export interface EditHeightBody {
  version: number;
  heightM: number;
  operationId?: string;
}

export interface EditDepthBody {
  version: number;
  depthM: number;
  operationId?: string;
}

export interface EditTypicalBody {
  version: number;
  typical: number;
  operationId?: string;
}

export interface CreateBlankSessionBody {
  title: string;
  proposalId?: string;
}

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

/**
 * Re-scaling a sheet restates every quantity measured on it, so the scale is
 * proposed before it is committed: the preview answers what each line would
 * become, and only the apply writes. `version` is the sheet version the client
 * was looking at — a scale applied over a sheet someone else re-calibrated
 * would silently re-bill figures nobody reviewed.
 */
export interface CalibrationPreviewBody {
  newScaleMmPerPt: number;
  version: number;
}

export interface ApplyCalibrationBody extends CalibrationPreviewBody {
  operationId?: string;
  reference?: { fromPt: [number, number]; toPt: [number, number]; enteredDistance: number; unit: "mm" | "cm" | "m" };
  previewToken?: string;
}

export interface ViewportPreviewBody {
  viewports: SheetViewportInput[];
  version: number;
}

export interface ApplyViewportsBody extends ViewportPreviewBody {
  operationId?: string;
  /** Required to drop a region that measurements were actually taken in. */
  confirmed?: boolean;
  previewToken?: string;
}

/** One bill line as the proposed scale regions would leave it. */
export interface ViewportImpactRow {
  rowId: string;
  description: string;
  version: number;
  currentQtyGross: number | null;
  newQtyGross: number;
  currentQty: number | null;
  newQty: number;
  unit: string | null;
}

/**
 * A region being withdrawn, and what was measured inside it. Those figures keep
 * the scale they were taken at, so nothing is restated — but the binding then
 * names a region that no longer exists, which is a decision, not a side effect.
 */
export interface RemovedRegion {
  viewportId: string;
  label: string;
  measurements: { rowId: string; geometryId: string; description: string }[];
}

export interface ViewportPreview {
  sheetId: string;
  sheetVersion: number;
  rescaled: ViewportImpactRow[];
  removed: RemovedRegion[];
  /** True when a region carrying measurements is withdrawn: the apply needs confirmation. */
  blocked: boolean;
  /** Lines the change would move that cannot be re-measured; they refuse the apply. */
  unresolvedRowIds: string[];
  previewToken: string;
}

/**
 * One bill line as the proposed scale would leave it. `hasUnresolvableBasis`
 * marks a line whose tool cannot be established from its stored definition or
 * its basis sentence, so its figure cannot be recomputed safely: the apply
 * leaves it exactly as it found it rather than guessing a new quantity.
 */
export interface CalibrationPreviewRow {
  rowId: string;
  description: string;
  /** The row version the figures below were read at; the apply is pinned to it. */
  version: number;
  currentQtyGross: number | null;
  newQtyGross: number | null;
  currentQty: number | null;
  newQty: number | null;
  unit: string | null;
  /** How many shapes were added up — a line is rarely one. */
  contributions: number;
  hasUnresolvableBasis: boolean;
}

export interface ScaleSuggestion {
  rowId: string;
  geometryId: string;
  proposedViewportId: string | null;
  unconfirmed: true;
}

export interface CalibrationPreview {
  sheetId: string;
  /** Null on a sheet nobody has scaled yet — nothing on it was measured against a sheet scale. */
  currentScaleMmPerPt: number | null;
  newScaleMmPerPt: number;
  sheetVersion: number;
  affectedRows: CalibrationPreviewRow[];
  unresolvedCount: number;
  unresolvedRowIds: string[];
  /** True when an unresolved line means the apply will be refused outright. */
  blocked: boolean;
  /** Shapes sitting over a different region than the one they record. */
  rebindSuggestions: ScaleSuggestion[];
  /** The old first-vertex rule's pick for an unclassified shape, never applied. */
  legacySuggestions: ScaleSuggestion[];
  /**
   * SHA-256 over the set of lines, shapes and versions these figures were read
   * from. The apply recomputes it under the lock and refuses on any difference.
   */
  previewToken: string;
}

export interface CalibrationReceiptRow {
  rowId: string;
  version: number;
  qtyGross: number | null;
  qty: number | null;
}

/** What the commit actually did: the sheet it moved, and every line it restated. */
export interface CalibrationReceipt {
  sheetId: string;
  version: number;
  scaleMmPerPt: number;
  rows: CalibrationReceiptRow[];
  unresolved: string[];
  unresolvedCount: number;
}

export interface ViewportsReceipt {
  sheetId: string;
  version: number;
  viewports: SheetViewport[];
  /** Every line the region change restated, in the same operation as the regions. */
  rows: CalibrationReceiptRow[];
}

export type UpdateStructureBody = Partial<Omit<StructureContext, "signals" | "confidence">>;

export interface UpdateLayerMapBody {
  layerMap: SessionLayerMap;
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
  // stated only when the outline crosses two scale regions, which is otherwise refused
  scaleChoice?: { source: "sheet" | "viewport"; viewportId?: string };
  // the logical outline, authoritative when present; `vertices` are derived from it
  shape?: unknown;
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

// One drawn shape billed as every item of an assembly; descriptions, units,
// element groups and rates come from the assembly's items, the rest from the
// drawing. `elementGroup` and `rate` are fallbacks for items that carry none.
export interface CreateAssemblyMeasurementBody extends Omit<CreateMeasurementBody, "description" | "elementGroup" | "unit"> {
  operationId?: string;
  assemblyId: string;
  elementGroup?: string;
}

// Take-off → estimate. Preview is a diff; apply writes the same list, pinned to
// the preview it came from. The contract lives in its own sibling.
export * from "./apply-to-estimate-types.ts";

export interface ExpectedVersion {
  id: string;
  version: number;
}

/**
 * Undoing an edit is itself an edit, so it carries its own `operationId` (a
 * retried undo is recorded once) and the versions the client believed were
 * current. If anything it names has moved on, the undo is refused rather than
 * applied over a state nobody reviewed.
 */
export interface ReverseOperationBody {
  operationId: string;
  expectedRows?: ExpectedVersion[];
  expectedSheets?: ExpectedVersion[];
  expectedMarkups?: ExpectedVersion[];
}

/** `reversed: false` is a refusal with a reason, never a failure to report. */
export type ReverseOperationResult =
  | { ok: true; reversed: true }
  | { ok: true; reversed: false; reason: string };

// ---------- bulk edits: split, trim, duplicate, merge, reassign ----------

