// The take-off editor's one write envelope, and the receipt it hands back.
//
// Every saved correction — moving a point, changing a wall height, withdrawing a
// shape — arrives as one `EditorOperationRequest` and leaves as one
// `OperationReceipt` owned by one audit event. That shape is what makes an edit
// to a contractual record safe to retry and safe to undo:
//
//   * `operationId` is minted by the client BEFORE it sends and reused on every
//     retry, so a save that timed out on the wire is recorded once, not twice.
//   * `expected*` are the versions the client believed were current. Anything
//     that has moved on refuses the whole operation rather than writing over a
//     state nobody reviewed.
//   * the command carries IDs and inputs ONLY. It never carries a quantity, an
//     amount or an audit snapshot: the server measures, and a client-supplied
//     figure would be a bill line nobody computed.
//   * the receipt names the real audit event id, so the undo that follows
//     addresses a record that exists rather than an empty string.

import type { EditorCommand } from "./editor-command-types.ts";
import type { Deduction, ExpectedVersion, GeometryKind, RowStatus } from "./types.ts";

export * from "./editor-command-types.ts";

export interface EditorOperationRequest {
  operationId: string;
  expectedRows?: ExpectedVersion[];
  expectedSheets?: ExpectedVersion[];
  expectedMarkups?: ExpectedVersion[];
  verify?: boolean;
  command: EditorCommand;
}

/**
 * What the caller is allowed to do, resolved from org permissions by the route.
 * An ordinary edit needs `edit`; bringing a new measurement into being also
 * needs `measure`; signing the result off also needs `verify`.
 */
export interface EditorGrants {
  edit: boolean;
  measure: boolean;
  verify: boolean;
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
  rows: ExpectedVersion[];
  geometries: ReceiptGeometry[];
  deletedRowIds: string[];
  deletedGeometryIds: string[];
  touchedSheetIds: string[];
}

/**
 * A bill line's editable state, bound whole into the audit entry so an undo can
 * restore it without re-deriving anything. System-maintained fields (version,
 * timestamps, who edited, who verified) are deliberately absent: a reversal
 * restores what was measured, and never restores a verification stamp.
 */
export interface RowStateV1 {
  description: string;
  unit: string | null;
  qtyGross: number | null;
  qty: number | null;
  deductions: Deduction[];
  typical: number;
  rate: number | null;
  amount: number | null;
  measurementBasis: string | null;
  status: RowStatus | null;
  // Stated quantity + repeat labels. Snapshotted or an undo leaves twelve names
  // against a restored count of one.
  measurementSettings: unknown;
  deleted: boolean;
}

export interface GeometryStateV1 {
  rowId: string;
  sheetId: string;
  kind: GeometryKind;
  vertices: number[][];
  quantity: number | null;
  unit: string | null;
  definition: unknown;
  parentGeometryId: string | null;
  deleted: boolean;
}

/**
 * A drawing's editable state. Re-scaling is an edit to the SHEET, and every line
 * on it is re-measured from that scale — so an undo that restored only the lines
 * would leave them disagreeing with the scale they are supposed to be measured at.
 */
export interface SheetStateV1 {
  scaleMmPerPt: number | null;
  calibration: unknown;
  viewports: unknown;
  overlaySettings: unknown;
}

/** `null` means the record did not exist at all at that point in the story. */
/**
 * A redline and the words hanging off it. Comments are recorded so a withdrawal
 * can be put back exactly as it stood — and so a reply added since is visible as
 * a difference rather than silently overwritten.
 */
export interface MarkupStateV1 {
  geometry: unknown;
  color: string | null;
  style: unknown;
  resolvedAt: string | null;
  deletedAt: string | null;
  version: number;
  comments: Record<string, { body: string; bodyHtml: string | null; deletedAt: string | null; version: number }>;
}

export interface OperationStateV1 {
  rows: Record<string, RowStateV1 | null>;
  geometries: Record<string, GeometryStateV1 | null>;
  sheets?: Record<string, SheetStateV1 | null>;
  markups?: Record<string, MarkupStateV1 | null>;
}

export interface OperationAuditBefore {
  schemaVersion: 1;
  state: OperationStateV1;
}

export interface OperationAuditAfter {
  schemaVersion: 1;
  state: OperationStateV1;
  /** SHA-256 over the validated command and versions, excluding operationId. */
  requestFingerprint: string;
  receipt: OperationReceipt;
}

/**
 * Reversing an entry that is an edit UNDOES it; reversing an entry that is
 * itself a compensation REDOES the edit that compensation withdrew. Both are
 * new attributed acts, so the trail keeps growing and nothing is erased.
 */
export type ReverseDirection = "undo" | "redo";

export type ReverseOperationOutcome =
  | { ok: true; reversed: true; direction: ReverseDirection; receipt: OperationReceipt }
  | { ok: true; reversed: false; reason: string };

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

export interface OperationReceiptRecord {
  eventId: string;
  operationId: string;
  action: string;
  actor: string;
  createdAt: string;
  reversesEventId: string | null;
  requestFingerprint: string | null;
  before: OperationStateV1 | null;
  after: OperationStateV1 | null;
  receipt: OperationReceipt | null;
}
