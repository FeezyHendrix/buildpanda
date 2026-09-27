// The persisted take-off workbook, as the API speaks it.
//
// This file is the contract the frontend compiles against. It is deliberately
// separate from `engine-types.ts`: that module owns what a workbook IS to the
// calculator (cells, formulas, values), this one owns what a workbook is to
// BuildPanda (a versioned, attributed document bound to measured bill lines).
// Keeping them apart is what stops the calculator growing an opinion about
// permissions, and stops the API growing an opinion about formulas.
//
// The one idea everything here turns on: IDENTITY LIVES IN THE LAYOUT. A cell
// knows its value and its formula; it never knows which bill line it stands
// for. That mapping is server-owned, arrives with every read, and is the only
// thing a write is checked against — so a client cannot rename a cell into
// another line's quantity, and cannot smuggle identity through `cell.custom`.

import type { CalculatedCellMatrix, WorkbookCellError, WorkbookSnapshot } from "./engine-types.ts";
import type { RowStatus } from "../row-types.ts";

// ---------------------------------------------------------------- persistence

/** `precon_workbooks`. One row per take-off; absent until the first save. */
export interface PreconWorkbookRow {
  session_id: string;
  snapshot: WorkbookSnapshot;
  layout: WorkbookLayout;
  version: number;
  engine_version: string;
  /** Derived cache. Says whether figures are behind; never authorises serving one. */
  source_fingerprint: string;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/** What this module writes to `precon_audit_events.action`. */
export const WORKBOOK_ACTIONS = ["workbook_edited", "workbook_reversed"] as const;
export type WorkbookAction = (typeof WORKBOOK_ACTIONS)[number];

/** The engine the stored formulas were last settled by, recorded with them. */
export const WORKBOOK_ENGINE_VERSION = "univer-oss-1.0.0";

// --------------------------------------------------------------------- layout

export const WORKBOOK_SHEET_KINDS = ["summary", "bill", "scratch"] as const;
export type WorkbookSheetKind = (typeof WORKBOOK_SHEET_KINDS)[number];

/**
 * What a column of a generated worksheet stands for.
 *
 * `description` and `rate` are the two a person may move, and they move through
 * `rowPatches` against the existing row policy — never by typing into the grid
 * and hoping the server believes it. Everything else is a rendering of a
 * measured figure and is refused outright.
 */
export const WORKBOOK_FIELDS = ["code", "description", "unit", "qty", "rate", "amount", "label"] as const;
export type WorkbookField = (typeof WORKBOOK_FIELDS)[number];

export const WORKBOOK_PATCHABLE_FIELDS = ["description", "rate"] as const;
export type WorkbookPatchableField = (typeof WORKBOOK_PATCHABLE_FIELDS)[number];

export function isPatchableField(field: WorkbookField): field is WorkbookPatchableField {
  return (WORKBOOK_PATCHABLE_FIELDS as readonly WorkbookField[]).includes(field);
}

/** Whether the bill line behind this slot still exists. */
export const WORKBOOK_BINDING_STATES = ["bound", "withdrawn"] as const;
export type WorkbookBindingState = (typeof WORKBOOK_BINDING_STATES)[number];

/**
 * How the live figure in this slot came to be — which decides what the UI may
 * offer, and each value means a different action:
 *
 *   `measured`  drawn, with the measurement recorded. Remeasure opens it.
 *   `legacy`    drawn before definitions were recorded. There is nothing to
 *               reopen, so it takes the existing basis-confirmation workflow.
 *   `stated`    a priced line with no annotation at all: a figure entered by
 *               hand. Offer Draw measurement — never fabricate an annotation.
 *   `narrative` a heading, work section or spec note. Carries no quantity.
 */
export const WORKBOOK_BASES = ["measured", "legacy", "stated", "narrative"] as const;
export type WorkbookBasis = (typeof WORKBOOK_BASES)[number];

export interface WorkbookBinding {
  readonly rowId: string;
  /** The source row's version this binding was last rendered from. */
  readonly rowVersion: number;
  /**
   * The worksheet row this line owns, 0-based, ASSIGNED ONCE.
   *
   * It is never recomputed from a sorted visible index. A withdrawn line keeps
   * its slot as a tombstone and a new line takes the next free one at the
   * bottom, so no cell a user's formula points at ever moves — which is a
   * stronger guarantee than adjusting references after moving them.
   */
  readonly gridRow: number;
  readonly state: WorkbookBindingState;
  readonly basis: WorkbookBasis;
  /** True only for a live, drawn, recorded line: `state` bound and `basis` measured. */
  readonly remeasurable: boolean;
  /** Annotations behind the figure, for the source chooser when there are several. */
  readonly geometryIds: readonly string[];
  /** Drawings those annotations live on. */
  readonly sourceSheetIds: readonly string[];
  /** The take-off revision this binding was made against. */
  readonly revision: number;
}

/** A bill on the Summary worksheet. `gridRow` is permanent, exactly as a binding's is. */
export interface WorkbookBillSlot {
  readonly billId: string;
  readonly gridRow: number;
  readonly label: string;
  readonly state: WorkbookBindingState;
}

export interface WorkbookSheetLayout {
  /** Stable worksheet id. Generated sheets derive it from the bill, so it survives a rename. */
  readonly sheetId: string;
  readonly kind: WorkbookSheetKind;
  readonly billId: string | null;
  /**
   * The worksheet's name in the snapshot, and therefore the name every
   * cross-sheet formula spells. PINNED at first save: renaming a bill must not
   * silently rewrite `=SUM('Bill No. 1'!F2:F9)` into a `#REF!`.
   */
  readonly name: string;
  /** The bill's title as it reads NOW. Shown to the user; may differ from `name`. */
  readonly label: string;
  /** Rows above the first binding: the column headings. */
  readonly firstBodyRow: number;
  /** First column a person may write anything into. Everything left of it is generated. */
  readonly freeColumnStart: number;
  /** Column index (decimal string) -> what the generated cell there stands for. */
  readonly columns: Readonly<Record<string, WorkbookField>>;
  readonly bindings: readonly WorkbookBinding[];
  /** Present on the summary worksheet only, where a slot stands for a bill. */
  readonly billSlots?: readonly WorkbookBillSlot[];
}

export interface WorkbookLayout {
  readonly schemaVersion: 1;
  readonly sheets: readonly WorkbookSheetLayout[];
}

// ------------------------------------------------------------------- document

/**
 * Whether the figures this workbook depends on can be relied on. Reading a
 * workbook never verifies anything, so this reports and never confers.
 */
export interface WorkbookReviewRollup {
  readonly boundRows: number;
  readonly verified: number;
  readonly needsReview: number;
  /** Drafted but never looked at: `ai_generated`, or no status at all. */
  readonly unreviewed: number;
  readonly withdrawn: number;
  /** Lines drawn without a recorded basis, so their figure cannot be reopened. */
  readonly missingBasis: number;
  /** Priced lines with no annotation behind them. */
  readonly stated: number;
  /** The stored snapshot was calculated against sources that have since moved. */
  readonly sourcesMoved: boolean;
}

/**
 * One coherent answer: the document, the trusted bindings, and what every cell
 * is worth RIGHT NOW. `values` is always recalculated from the live rows — it
 * is never read back from storage, so a figure here is never a stale cache.
 */
export interface WorkbookDocument {
  readonly sessionId: string;
  /** 0 means no workbook has ever been saved and this is the deterministic first draft. */
  readonly version: number;
  readonly engineVersion: string;
  readonly snapshot: WorkbookSnapshot;
  readonly layout: WorkbookLayout;
  /** Sheet id -> row -> column -> current value and the formula that produced it. */
  readonly values: Readonly<Record<string, CalculatedCellMatrix>>;
  /** Cells whose formula produced no usable figure. Their value is `null`, never 0. */
  readonly errors: readonly WorkbookCellError[];
  readonly sourceFingerprint: string;
  readonly reviewRollup: WorkbookReviewRollup;
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
  readonly history: readonly WorkbookHistoryEntry[];
}

// ----------------------------------------------------------------- write path

/**
 * An explicit change to a bill line, carried alongside the snapshot and applied
 * in the same transaction. Only the two fields the grid may not own, and each
 * still goes through the row policy that decides whether the line needs
 * re-reviewing. `version` is what the client believed; anything else refuses.
 */
export interface WorkbookRowPatch {
  readonly rowId: string;
  readonly version: number;
  readonly description?: string;
  /** `null` clears the rate. The route schema refuses it; only an undo sends it. */
  readonly rate?: number | null;
}

export interface WorkbookSaveRequest {
  readonly operationId: string;
  readonly expectedVersion: number;
  readonly expectedSourceFingerprint: string;
  /** Untrusted until `validateWorkbookSnapshot` and `sanitizeCandidate` have both run. */
  readonly snapshot: unknown;
  readonly rowPatches?: readonly WorkbookRowPatch[];
}

export interface WorkbookReverseRequest {
  readonly operationId: string;
  readonly expectedVersion: number;
  readonly expectedSourceFingerprint: string;
}

export interface WorkbookSaveResult {
  readonly eventId: string;
  readonly operationId: string;
  /** True when this is a retry answered from the first attempt's record. */
  readonly replayed: boolean;
  /** What the write did, as it was recorded. Identical on the original call and every retry. */
  readonly receipt: WorkbookReceipt;
  /** The workbook as it is NOW, which after a later edit is not what the receipt describes. */
  readonly document: WorkbookDocument;
}

/**
 * Broadcast on `precon:<sessionId>` after the transaction commits, so another
 * tab drops its cached workbook — and its cached bill lines when a rate moved.
 * Never emitted for a replay (nothing changed) or a rollback (nothing landed).
 */
export interface WorkbookChangeEvent {
  readonly type: "workbook.updated";
  readonly sessionId: string;
  readonly version: number;
  readonly actor: string;
  readonly eventId: string;
  readonly operationId: string;
  readonly action: WorkbookAction;
  readonly sourceFingerprint: string;
  /** Bill lines this write moved, with their fresh versions. Empty when only cells changed. */
  readonly rows: readonly { readonly id: string; readonly version: number }[];
}

/**
 * A reversal either happened or was refused with a reason a person can act on.
 * A refusal is not a failure: it is the server saying a human must decide.
 */
export type WorkbookReverseResult =
  | {
      readonly ok: true;
      readonly reversed: true;
      readonly direction: WorkbookReverseDirection;
      readonly eventId: string;
      readonly operationId: string;
      readonly replayed: boolean;
      readonly receipt: WorkbookReceipt;
      readonly document: WorkbookDocument;
    }
  | { readonly ok: true; readonly reversed: false; readonly reason: string };

export type WorkbookReverseDirection = "undo" | "redo";

// --------------------------------------------------------------------- audit

/** A bill line's patchable state, recorded either side of a save. */
export interface WorkbookRowDelta {
  readonly rowId: string;
  readonly version: number;
  readonly description: string;
  readonly rate: number | null;
  readonly amount: number | null;
  readonly status: RowStatus | null;
}

/**
 * The complete editable workbook at one moment, plus the source rows the save
 * touched. `snapshot` is `null` when no workbook existed — which is what makes
 * undoing the very first save able to put the absence back rather than leaving
 * an empty version 1 behind.
 */
export interface WorkbookStateV1 {
  readonly version: number;
  readonly snapshot: WorkbookSnapshot | null;
  readonly layout: WorkbookLayout | null;
  readonly sourceFingerprint: string | null;
  readonly rows: Readonly<Record<string, WorkbookRowDelta>>;
}

/**
 * What one committed write DID, recorded with it and never recomputed.
 *
 * Deliberately has no `replayed` flag: that is a fact about the CALL, not about
 * the write, and it lives on the envelope. A receipt read back from the trail
 * is byte-identical to the one its original call returned — which is the whole
 * point, because a client reconciling "did my save land, and as what?" must be
 * answered with the original figures and not with whatever the workbook has
 * since become.
 */
export interface WorkbookReceipt {
  readonly eventId: string;
  readonly operationId: string;
  readonly version: number;
  readonly sourceFingerprint: string;
  readonly rows: readonly { readonly id: string; readonly version: number }[];
}

export interface WorkbookAuditBefore {
  readonly schemaVersion: 1;
  readonly state: WorkbookStateV1;
}

export interface WorkbookAuditAfter {
  readonly schemaVersion: 1;
  readonly state: WorkbookStateV1;
  /** SHA-256 over the validated request, excluding `operationId`. */
  readonly requestFingerprint: string;
  readonly receipt: WorkbookReceipt;
}

// ------------------------------------------------------------------- history

export interface WorkbookHistoryEntry {
  readonly eventId: string;
  readonly operationId: string;
  readonly action: WorkbookAction;
  readonly actor: string;
  readonly createdAt: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  /** Bill lines whose rate or description this entry moved. */
  readonly rowIds: readonly string[];
  readonly reversesEventId: string | null;
  readonly reversedByEventId: string | null;
  readonly direction: WorkbookReverseDirection;
  /** Whether it can be reversed right now, and if not, why not. */
  readonly eligible: boolean;
  readonly reason: string | null;
}

export interface WorkbookHistory {
  readonly operations: readonly WorkbookHistoryEntry[];
}
