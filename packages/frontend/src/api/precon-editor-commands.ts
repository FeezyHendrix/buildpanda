// The command shapes the take-off editor's operation envelope carries — an
// exact mirror of the backend's `editor-operation-types.ts` (pdf-takeoff).
//
// A command carries IDs and inputs ONLY — never a quantity, amount or audit
// snapshot. The server measures, so a client can never state a figure the
// bill then treats as measured.
import type { MeasureTool, MeasurementShape } from "./precon-row-types";

/** An entity id paired with the version the caller was looking at. */
export interface VersionedRef {
  id: string;
  version: number;
}

/** heightM for a wall run, depthM for a volume — as the backend re-measures. */
export interface MeasureFactor {
  heightM?: number;
  depthM?: number;
}

/** What the QS states about a legacy line that never recorded its own basis. */
export interface DefinitionConfirmation {
  tool: MeasureTool;
  unit: string;
  factor?: MeasureFactor;
}

/** The whole-shape scale for a NEW outline crossing regions (contract 12). */
export interface ScaleChoice {
  source: "sheet" | "viewport";
  viewportId?: string;
}

export interface CreateGeometryCommand {
  kind: "create-geometry";
  sheetId: string;
  tool: MeasureTool;
  /** Straight outline; OR send `shape` and let the server tessellate. */
  vertices?: number[][];
  shape?: MeasurementShape;
  description: string;
  elementGroup: string;
  code?: string;
  unit?: string;
  factor?: MeasureFactor;
  typical?: number;
  rate?: number;
  billId?: string;
  scaleChoice?: ScaleChoice;
}

/** Correcting the shape in place. The geometry id is the subject, never the row. */
export interface UpdateGeometryCommand {
  kind: "update-geometry";
  geometryId: string;
  /** Straight outline; OR send `shape` (authoritative, arcs measured analytically). */
  vertices?: number[][];
  shape?: MeasurementShape;
  /** REQUIRED by the server before a legacy (NULL-definition) line's quantity may change. */
  confirm?: DefinitionConfirmation;
}

/** Changes a RECORDED scale binding; the figure will move and the line returns for review. */
export interface RebindGeometryCommand {
  kind: "rebind-geometry";
  geometryId: string;
  scaleChoice: { source: "sheet" } | { source: "viewport"; viewportId: string };
}

/**
 * Withdrawing one shape. The row goes with it only when it was the row's last
 * measurement; both are tombstones, restorable by an undo.
 */
export interface DeleteGeometryCommand {
  kind: "delete-geometry";
  geometryId: string;
}

export interface SetRowFactorCommand {
  kind: "set-row-factor";
  rowId: string;
  heightM?: number;
  depthM?: number;
}

export interface SetRowTypicalCommand {
  kind: "set-row-typical";
  rowId: string;
  typical: number;
}

export type DeductionMode = "area" | "volume" | "length" | "count" | "wall-opening";

export interface AddDeductionCommand {
  kind: "add-deduction";
  rowId: string;
  label: string;
  mode?: DeductionMode;
  vertices?: number[][];
  dimensions?: { widthM?: number; heightM?: number; depthM?: number };
  sheetId?: string;
}

export interface EditDeductionCommand {
  kind: "edit-deduction";
  rowId: string;
  geometryId: string;
  vertices?: number[][];
  dimensions?: { widthM?: number; heightM?: number; depthM?: number };
}

export interface RemoveDeductionCommand {
  kind: "remove-deduction";
  rowId: string;
  geometryId: string;
}

/**
 * Exactly which STATED (geometry-less) opening is meant, and exactly what it
 * says right now. A position is not an identity, so the index is paired with
 * the row version AND a full statement of the entry — both must hold or the
 * command is refused rather than landing on whatever now sits in that slot.
 */
export interface StatedDeductionTarget {
  rowId: string;
  rowVersion: number;
  index: number;
  expect: { label: string; qty: number; unit: string | null };
}

/** Re-enter a legacy stated opening as typed numbers; the unit MUST be confirmed explicitly. */
export interface EditStatedDeductionCommand extends StatedDeductionTarget {
  kind: "edit-stated-deduction";
  label?: string;
  qty: number;
  unit: string;
  unitConfirmed: true;
}

export interface RemoveStatedDeductionCommand extends StatedDeductionTarget {
  kind: "remove-stated-deduction";
}

export interface ApplyCalibrationCommand {
  kind: "apply-calibration";
  sheetId: string;
  mmPerPt?: number;
  reference?: { fromPt: [number, number]; toPt: [number, number]; enteredDistance: number; unit: "mm" | "cm" | "m" };
  /** The fingerprint the preview returned; the apply refuses if it no longer holds. */
  previewToken?: string;
}

export interface ApplyViewportsCommand {
  kind: "apply-viewports";
  sheetId: string;
  viewports: { id?: string; label: string; rect: [number, number, number, number]; scaleMmPerPt: number }[];
  /** Required to withdraw a region that measurements were actually taken in. */
  confirmed?: boolean;
  previewToken?: string;
}

export interface SplitPolylineCommand {
  kind: "split-polyline";
  rowId: string;
  geometryId: string;
  vertexIndex: number;
}

export interface RemoveSegmentCommand {
  kind: "remove-segment";
  rowId: string;
  geometryId: string;
  segmentIndex: number;
}

export interface DuplicateGeometryCommand {
  kind: "duplicate-geometry";
  rowId: string;
  geometryId: string;
  offset: [number, number];
  targetSheetId?: string;
  crossSheet?: "preserve-real-size" | "retrace";
}

export interface MergeGeometriesCommand {
  kind: "merge-geometries";
  rowIds: string[];
}

export interface TransformGeometryCommand {
  kind: "transform-geometry";
  rowId: string;
  geometryId: string;
  translate?: [number, number];
  rotateDeg?: number;
  about?: [number, number];
}

export interface SplitPolygonCommand {
  kind: "split-polygon";
  rowId: string;
  geometryId: string;
  cut: [[number, number], [number, number]];
}

export interface ReassignGeometryCommand {
  kind: "reassign-geometry";
  geometryId: string;
  targetRowId: string;
}

export interface CreateAssemblyCommand {
  kind: "create-assembly";
  sheetId: string;
  assemblyId: string;
  tool: MeasureTool;
  vertices: number[][];
  elementGroup?: string;
  code?: string;
  factor?: MeasureFactor;
  typical?: number;
  rate?: number;
  billId?: string;
}

export interface DuplicateRowCommand {
  kind: "duplicate-row";
  rowId: string;
  offset?: [number, number];
  targetSheetId?: string;
  crossSheet?: "preserve-real-size" | "retrace";
}

export interface SetMeasurementSettingsCommand {
  kind: "set-measurement-settings";
  rowId: string;
  repeatLabels: string[];
}

export interface SplitRepeatExceptionCommand {
  kind: "split-repeat-exception";
  rowId: string;
  label: string;
  confirmed: boolean;
}

export interface SetOverlayCommand {
  kind: "set-overlay";
  sheetId: string;
  overlay: {
    sourceSheetId: string;
    opacity: number;
    anchors: { source: number[]; target: number[] }[];
  } | null;
}

export interface EditMarkupCommand {
  kind: "edit-markup";
  markupId: string;
  version: number;
  geometry?: unknown;
  color?: string;
  style?: { color?: string; strokeWidthPx?: number };
}

export interface DeleteMarkupCommand {
  kind: "delete-markup";
  markupId: string;
  version: number;
}

export interface RestoreMarkupCommand {
  kind: "restore-markup";
  markupId: string;
}

export interface EditMarkupCommentCommand {
  kind: "edit-comment";
  markupId: string;
  commentId: string;
  version: number;
  body: string;
  bodyHtml?: string | null;
}

/** Persist a legacy line's stated basis; a receipt of its own (contract 22). */
export interface ConfirmMeasurementBasisCommand {
  kind: "confirm-measurement-basis";
  rowId: string;
  geometryId: string;
  tool: MeasureTool;
  factor?: MeasureFactor;
  unit?: string;
  scaleChoice?: ScaleChoice;
}

/**
 * ≤200 members, no nesting; one transaction, one receipt, one undo. One stale
 * member means NONE commit.
 */
export interface BatchCommand {
  kind: "batch";
  commands: Exclude<EditorCommand, BatchCommand>[];
}

export type EditorCommand =
  | BatchCommand
  | RebindGeometryCommand
  | CreateGeometryCommand
  | UpdateGeometryCommand
  | DeleteGeometryCommand
  | SetRowFactorCommand
  | SetRowTypicalCommand
  | AddDeductionCommand
  | EditDeductionCommand
  | RemoveDeductionCommand
  | EditStatedDeductionCommand
  | RemoveStatedDeductionCommand
  | ApplyCalibrationCommand
  | ApplyViewportsCommand
  | SplitPolylineCommand
  | RemoveSegmentCommand
  | DuplicateGeometryCommand
  | TransformGeometryCommand
  | SplitPolygonCommand
  | CreateAssemblyCommand
  | DuplicateRowCommand
  | SetMeasurementSettingsCommand
  | SplitRepeatExceptionCommand
  | MergeGeometriesCommand
  | ReassignGeometryCommand
  | SetOverlayCommand
  | EditMarkupCommand
  | DeleteMarkupCommand
  | RestoreMarkupCommand
  | EditMarkupCommentCommand
  | ConfirmMeasurementBasisCommand;
