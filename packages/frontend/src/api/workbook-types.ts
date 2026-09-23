// The take-off workbook as the API speaks it.
//
// Every type here is a hand-written mirror of
// `backend/src/modules/panda-ai/pdf-takeoff/workbook/types.ts` and its
// `engine-types.ts`. It is deliberately a mirror rather than a shared package:
// the backend owns a NARROW subset of a spreadsheet document and refuses
// everything outside it, so the browser must compile against that subset and
// not against Univer's far wider `IWorkbookData`. A field that exists in Univer
// and not here is a field the server will refuse — which is exactly what these
// declarations are for.
//
// No `any`, and no index signature that would let an unchecked vendor field
// through unnoticed.

// ------------------------------------------------------------ engine subset

/** A style entry, carried verbatim. Formatting never changes a calculated figure. */
export type WorkbookStyle = Readonly<Record<string, unknown>>;

/** What a cell can hold once calculated. `null` is empty, and is never a stand-in for 0. */
export type WorkbookCellValue = string | number | boolean | null;

/** Univer's cell value types, restricted to the four the server accepts. */
export type WorkbookCellType = 1 | 2 | 3 | 4;

export interface WorkbookCell {
  /** Literal value. Absent for a pure formula cell. */
  readonly v?: WorkbookCellValue;
  /** Raw formula text including the leading `=`. Never rewritten. */
  readonly f?: string;
  /** Style id into the workbook's style table. The one field a client may move on a protected cell. */
  readonly s?: string;
  readonly t?: WorkbookCellType;
}

/** Row index -> column index -> cell, keyed by decimal integers as Univer stores them. */
export type WorkbookCellMatrix = Readonly<Record<string, Readonly<Record<string, WorkbookCell>>>>;

export interface WorkbookSheet {
  readonly id: string;
  readonly name: string;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly cellData: WorkbookCellMatrix;
}

export interface WorkbookSnapshot {
  readonly id: string;
  readonly name: string;
  readonly sheetOrder: readonly string[];
  readonly sheets: Readonly<Record<string, WorkbookSheet>>;
  readonly styles: Readonly<Record<string, WorkbookStyle>>;
}

export interface CalculatedCell {
  readonly value: WorkbookCellValue;
  /** Formula text as stored, or `null` for a literal. */
  readonly formula: string | null;
}

export type CalculatedCellMatrix = Readonly<Record<string, Readonly<Record<string, CalculatedCell>>>>;

export const WORKBOOK_ERROR_CODES = [
  "#DIV/0!",
  "#N/A",
  "#NAME?",
  "#NULL!",
  "#NUM!",
  "#REF!",
  "#VALUE!",
  "#SPILL!",
  "#CALC!",
  "NON_FINITE",
] as const;
export type WorkbookErrorCode = (typeof WORKBOOK_ERROR_CODES)[number];

export interface WorkbookCellError {
  readonly sheetId: string;
  readonly row: number;
  readonly column: number;
  readonly formula: string | null;
  readonly code: WorkbookErrorCode;
}

// -------------------------------------------------------------------- layout

export type WorkbookSheetKind = "summary" | "bill" | "scratch";

export const WORKBOOK_FIELDS = ["code", "description", "unit", "qty", "rate", "amount", "label"] as const;
export type WorkbookField = (typeof WORKBOOK_FIELDS)[number];

/** The only two generated fields a person may move, and only through `rowPatches`. */
export const WORKBOOK_PATCHABLE_FIELDS = ["description", "rate"] as const;
export type WorkbookPatchableField = (typeof WORKBOOK_PATCHABLE_FIELDS)[number];

export function isPatchableField(field: WorkbookField): field is WorkbookPatchableField {
  return (WORKBOOK_PATCHABLE_FIELDS as readonly WorkbookField[]).includes(field);
}

export type WorkbookBindingState = "bound" | "withdrawn";

/**
 * How the live figure in this slot came to be — which decides what the UI may
 * offer. `measured` reopens the annotation; `legacy` has none to reopen and
 * takes the basis-confirmation flow; `stated` offers Draw and never fabricates
 * an annotation; `narrative` carries no quantity at all.
 */
export type WorkbookBasis = "measured" | "legacy" | "stated" | "narrative";

export interface WorkbookBinding {
  readonly rowId: string;
  readonly rowVersion: number;
  /** The 0-based worksheet row this line owns. Permanent; never a sorted index. */
  readonly gridRow: number;
  readonly state: WorkbookBindingState;
  readonly basis: WorkbookBasis;
  readonly remeasurable: boolean;
  readonly geometryIds: readonly string[];
  readonly sourceSheetIds: readonly string[];
  readonly revision: number;
}

export interface WorkbookBillSlot {
  readonly billId: string;
  readonly gridRow: number;
  readonly label: string;
  readonly state: WorkbookBindingState;
}

export interface WorkbookSheetLayout {
  readonly sheetId: string;
  readonly kind: WorkbookSheetKind;
  readonly billId: string | null;
  /**
   * The worksheet's name in the snapshot, and therefore the name every
   * cross-sheet formula spells. PINNED server-side — never render it; render
   * `label`, which carries the bill's current title.
   */
  readonly name: string;
  readonly label: string;
  readonly firstBodyRow: number;
  /** First column a person may write into. Everything left of it is generated. */
  readonly freeColumnStart: number;
  readonly columns: Readonly<Record<string, WorkbookField>>;
  readonly bindings: readonly WorkbookBinding[];
  readonly billSlots?: readonly WorkbookBillSlot[];
}

export interface WorkbookLayout {
  readonly schemaVersion: 1;
  readonly sheets: readonly WorkbookSheetLayout[];
}

// ------------------------------------------------------------------ document

export interface WorkbookReviewRollup {
  readonly boundRows: number;
  readonly verified: number;
  readonly needsReview: number;
  readonly unreviewed: number;
  readonly withdrawn: number;
  readonly missingBasis: number;
  readonly stated: number;
  /** The stored snapshot was calculated against sources that have since moved. */
  readonly sourcesMoved: boolean;
}

export type WorkbookAction = "workbook_edited" | "workbook_reversed";
export type WorkbookReverseDirection = "undo" | "redo";

export interface WorkbookHistoryEntry {
  readonly eventId: string;
  readonly operationId: string;
  readonly action: WorkbookAction;
  readonly actor: string;
  readonly createdAt: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly rowIds: readonly string[];
  readonly reversesEventId: string | null;
  readonly reversedByEventId: string | null;
  readonly direction: WorkbookReverseDirection;
  readonly eligible: boolean;
  readonly reason: string | null;
}

export interface WorkbookHistory {
  readonly operations: readonly WorkbookHistoryEntry[];
}

export interface WorkbookDocument {
  readonly sessionId: string;
  /** 0 means no workbook has ever been saved. Not an error. */
  readonly version: number;
  readonly engineVersion: string;
  readonly snapshot: WorkbookSnapshot;
  readonly layout: WorkbookLayout;
  /** Sheet id -> row -> column -> current value. Always recalculated; never a cache. */
  readonly values: Readonly<Record<string, CalculatedCellMatrix>>;
  readonly errors: readonly WorkbookCellError[];
  readonly sourceFingerprint: string;
  readonly reviewRollup: WorkbookReviewRollup;
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
  readonly history: readonly WorkbookHistoryEntry[];
}

// ---------------------------------------------------------------- write path

export interface WorkbookRowPatch {
  readonly rowId: string;
  readonly version: number;
  readonly description?: string;
  readonly rate?: number;
}

export interface WorkbookSaveRequest {
  readonly operationId: string;
  readonly expectedVersion: number;
  readonly expectedSourceFingerprint: string;
  readonly snapshot: WorkbookSnapshot;
  readonly rowPatches?: readonly WorkbookRowPatch[];
}

export interface WorkbookReverseRequest {
  readonly operationId: string;
  readonly expectedVersion: number;
  readonly expectedSourceFingerprint: string;
}

/**
 * What one committed write DID. Byte-identical on the original call and on
 * every retry — which is what makes "did my save land, and as what?" answerable
 * after a colleague has since saved over the top.
 */
export interface WorkbookReceipt {
  readonly eventId: string;
  readonly operationId: string;
  readonly version: number;
  readonly sourceFingerprint: string;
  readonly rows: readonly { readonly id: string; readonly version: number }[];
}

export interface WorkbookSaveResult {
  readonly eventId: string;
  readonly operationId: string;
  /** True when this is a retry answered from the first attempt's record. */
  readonly replayed: boolean;
  readonly receipt: WorkbookReceipt;
  /** The workbook as it is NOW, which after a later edit is not what the receipt describes. */
  readonly document: WorkbookDocument;
}

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

/**
 * Broadcast on `precon:<sessionId>` after the transaction commits. Emitted once
 * per committed write — never for a replay and never for a refusal, so an
 * arriving frame always means something really changed.
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
