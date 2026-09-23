// Every command the take-off editor can send, and nothing else.
//
// Split out of `editor-operation-types.ts` so neither file outgrows a reviewer:
// this one is the vocabulary of edits, that one is the envelope they travel in
// and the receipt they come back as. `editor-operation-types.ts` re-exports all
// of it, so an importer never has to know which half a name lives in.
import type { ScaleChoice } from "./editor-scale-binding.ts";
import type {
  AddDeductionCommand,
  EditDeductionCommand,
  EditStatedDeductionCommand,
  RemoveDeductionCommand,
  RemoveStatedDeductionCommand,
} from "./editor-deduction-command-types.ts";

export type * from "./editor-deduction-command-types.ts";
import type { DefinitionConfirmation, MeasureFactor, MeasureTool } from "./types.ts";

export interface CreateGeometryCommand {
  kind: "create-geometry";
  sheetId: string;
  tool: MeasureTool;
  /** Optional when `shape` is sent; the server derives them from it, exactly as `update-geometry` does. */
  vertices?: number[][];
  description: string;
  elementGroup: string;
  code?: string;
  unit?: string;
  factor?: MeasureFactor;
  typical?: number;
  rate?: number;
  billId?: string;
  /**
   * The logical outline — a path of line and arc segments, or a set of marks.
   * Authoritative when present: the stored `vertices` are the tessellation the
   * SERVER derives from it, so a curve stays a curve through every reload.
   * Sending both this and a different `vertices` is refused, never resolved.
   */
  shape?: unknown;
  /**
   * Which scale the WHOLE shape is measured at, when its outline crosses regions
   * drawn at different scales. Without it such a shape is refused rather than
   * resolved by whichever end happened to be drawn first (contract 12).
   */
  scaleChoice?: ScaleChoice;
}

/**
 * Stating the basis of a shape that records none — a legacy or imported outline
 * with a bare `vertices` array and nothing saying what tool measured it, at what
 * height and against which scale.
 *
 * It is a separate command rather than a flag on an edit because it is a
 * different act: nothing about the drawing changes, a person states what the
 * saved figure always meant. Until one is stated the server refuses to
 * re-measure the line at all (contracts 3 and 22), so this is the only way past
 * a blocked re-calibration — and it is audited, versioned and reversible like
 * any other correction.
 */
export interface ConfirmMeasurementBasisCommand {
  kind: "confirm-measurement-basis";
  rowId: string;
  geometryId: string;
  tool: MeasureTool;
  factor?: MeasureFactor;
  unit?: string;
  scaleChoice?: ScaleChoice;
}

/** Correcting the shape in place. The geometry id is the subject, never the row. */
export interface UpdateGeometryCommand {
  kind: "update-geometry";
  geometryId: string;
  /** Optional when `shape` is sent; the server derives them from it. */
  vertices?: number[][];
  shape?: unknown;
  confirm?: DefinitionConfirmation;
}

/**
 * Withdrawing one shape. The row goes with it only when it was the row's last
 * measurement, and both are tombstones: a quantity that was once claimed stays
 * readable in a dispute and stays restorable by an undo.
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

/** The count follows the names: twelve labels is twelve bays, measured one included. */
export interface SetMeasurementSettingsCommand {
  kind: "set-measurement-settings";
  rowId: string;
  repeatLabels: string[];
}

/** Billing one named instance on its own; the set it leaves falls by one. */
export interface SplitRepeatExceptionCommand {
  kind: "split-repeat-exception";
  rowId: string;
  label: string;
  confirmed: boolean;
}




/** Re-scaling a drawing restates every line measured on it, so it is one operation. */
export interface ApplyCalibrationCommand {
  kind: "apply-calibration";
  sheetId: string;
  mmPerPt?: number;
  reference?: { fromPt: [number, number]; toPt: [number, number]; enteredDistance: number; unit: "mm" | "cm" | "m" };
  /** The fingerprint the preview returned. The apply refuses if it no longer holds. */
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
  /** A copy onto another drawing keeps its real size by default (contract 10). */
  targetSheetId?: string;
  crossSheet?: "preserve-real-size" | "retrace";
}

/** Moving or rotating a drawing. It measures the same thing in a new place. */
export interface TransformGeometryCommand {
  kind: "transform-geometry";
  rowId: string;
  geometryId: string;
  translate?: [number, number];
  rotateDeg?: number;
  about?: [number, number];
}

/** Cutting an area in two along a drawn line. Both pieces stay on the line. */
export interface SplitPolygonCommand {
  kind: "split-polygon";
  rowId: string;
  geometryId: string;
  cut: [[number, number], [number, number]];
}

/**
 * One drawn shape billed as every item of a rate-library assembly. It produces N
 * independent lines, so the receipt names all of them and the undo withdraws
 * them together.
 */
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

/** Copying a whole line: every drawing it carries, and every void in them. */
export interface DuplicateRowCommand {
  kind: "duplicate-row";
  rowId: string;
  offset?: [number, number];
  targetSheetId?: string;
  crossSheet?: "preserve-real-size" | "retrace";
}

export interface MergeGeometriesCommand {
  kind: "merge-geometries";
  rowIds: string[];
}

/**
 * How a previous revision sits over this drawing, or `null` to unalign it. It is
 * in the write envelope for attribution and ordering only: it moves no figure
 * and clears no sign-off (contract 23).
 */
export interface SetOverlayCommand {
  kind: "set-overlay";
  sheetId: string;
  overlay: {
    sourceSheetId: string;
    opacity: number;
    anchors: { source: number[]; target: number[] }[];
  } | null;
}

/**
 * A selection saved as one act: one transaction, one snapshot, one receipt, one
 * undo. A stale member writes nothing rather than part of the list, which is
 * what a client looping N single operations could never promise.
 */
export interface BatchCommand {
  kind: "batch";
  commands: EditorCommand[];
}

/**
 * Re-pointing a DEFINED shape at the scale it should have been measured
 * against. `confirm-measurement-basis` states a basis that was never recorded;
 * this CHANGES one that was, so it is a separate, explicit act that re-measures
 * the whole line and its openings and sends it back for review.
 */
export interface RebindGeometryCommand {
  kind: "rebind-geometry";
  geometryId: string;
  scaleChoice: ScaleChoice;
}

/**
 * Redline changes. Each carries the version it believes is current — including
 * the withdrawal, where an omitted version used to mean "delete whatever is
 * there", which is the one thing a withdrawal of evidence may not mean.
 */
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

export interface ReassignGeometryCommand {
  kind: "reassign-geometry";
  geometryId: string;
  targetRowId: string;
}

export type EditorCommand =
  | CreateGeometryCommand
  | UpdateGeometryCommand
  | DeleteGeometryCommand
  | SetRowFactorCommand
  | SetRowTypicalCommand
  | SetMeasurementSettingsCommand
  | SplitRepeatExceptionCommand
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
  | MergeGeometriesCommand
  | ReassignGeometryCommand
  | ConfirmMeasurementBasisCommand
  | SetOverlayCommand
  | EditMarkupCommand
  | DeleteMarkupCommand
  | RestoreMarkupCommand
  | EditMarkupCommentCommand
  | RebindGeometryCommand
  | BatchCommand
;

// The first five names are FROZEN: the frontend wires against them.
export const EDITOR_COMMAND_KINDS = [
  "create-geometry",
  "update-geometry",
  "delete-geometry",
  "set-row-factor",
  "set-row-typical",
  "add-deduction",
  "edit-deduction",
  "remove-deduction",
  "edit-stated-deduction",
  "remove-stated-deduction",
  "apply-calibration",
  "apply-viewports",
  "split-polyline",
  "remove-segment",
  "duplicate-geometry",
  "transform-geometry",
  "split-polygon",
  "create-assembly",
  "duplicate-row",
  "merge-geometries",
  "reassign-geometry",
  "set-measurement-settings",
  "split-repeat-exception",
  "confirm-measurement-basis",
  "set-overlay",
  "edit-markup",
  "delete-markup",
  "restore-markup",
  "edit-comment",
  "rebind-geometry",
  "batch",
] as const;

/** Commands that bring a new measurement into being; they need `measure` too. */
export const MEASURING_COMMAND_KINDS: readonly EditorCommand["kind"][] = [
  "create-geometry",
  "duplicate-geometry",
  "transform-geometry",
  "split-polygon",
  "create-assembly",
  "duplicate-row",
  // It mints a copy of a measurement onto a new line, so it needs the same
  // grant drawing one would.
  "split-repeat-exception",
];
