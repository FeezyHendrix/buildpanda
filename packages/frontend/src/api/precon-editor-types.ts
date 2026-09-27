// The take-off editor's wire contract — an exact mirror of the backend's
// `editor-operation-types.ts` (pdf-takeoff). One envelope in, one receipt out:
//
//   * `operationId` is minted by the client BEFORE sending and reused on every
//     retry of the same gesture, so a save that timed out is recorded once.
//   * `expected*` pin the versions the client believed were current; the server
//     refuses the whole operation on drift rather than writing over it.
//   * commands carry IDs and inputs only — never a quantity, amount or audit
//     snapshot. The server measures.
//   * the receipt names the real audit `eventId`, which is what a later undo
//     addresses through `editorApi.reverse`.
//
// The command shapes live in `precon-editor-commands`, and the write-nothing
// calibration/viewport previews in `precon-editor-previews`; both are
// re-exported here so this stays the one module callers import.
import type { EditorCommand, VersionedRef } from "./precon-editor-commands";

export * from "./precon-editor-commands";
export * from "./precon-editor-previews";
export type { MeasurementShape, PathSegment } from "./precon-row-types";

export interface EditorOperationRequest {
  operationId: string;
  expectedRows?: VersionedRef[];
  expectedSheets?: VersionedRef[];
  expectedMarkups?: VersionedRef[];
  verify?: boolean;
  command: EditorCommand;
}

export interface ReceiptGeometry {
  id: string;
  rowId: string;
  sheetId: string;
}

export interface OperationReceipt {
  /** The audit event that owns this operation. An undo addresses it by id. */
  eventId: string;
  operationId: string;
  /** True when this is a retry answered from the first attempt's record. */
  replayed: boolean;
  rows: VersionedRef[];
  geometries: ReceiptGeometry[];
  deletedRowIds: string[];
  deletedGeometryIds: string[];
  touchedSheetIds: string[];
}

/**
 * Reversing an edit entry UNDOES it; reversing a compensation entry REDOES the
 * edit that compensation withdrew. Both are new attributed acts.
 */
export type ReverseDirection = "undo" | "redo";

export type ReverseOperationOutcome =
  | { ok: true; reversed: true; direction: ReverseDirection; receipt: OperationReceipt }
  | { ok: true; reversed: false; reason: string };

export interface EditorReverseBody {
  operationId: string;
  expectedRows?: VersionedRef[];
  expectedSheets?: VersionedRef[];
  expectedMarkups?: VersionedRef[];
}

export interface OperationHistoryEntry {
  eventId: string;
  operationId: string;
  action: string;
  actor: string;
  createdAt: string;
  rowIds: string[];
  sheetIds: string[];
  reversesEventId: string | null;
  reversedByEventId: string | null;
  direction: ReverseDirection;
  /** Whether this entry can be reversed right now, and if not, why not. */
  eligible: boolean;
  reason: string | null;
}

export interface OperationHistory {
  operations: OperationHistoryEntry[];
}
