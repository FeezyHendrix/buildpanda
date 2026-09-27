// The shape of a takeoff workbook as this module accepts it, and the shape of
// one calculation's answer.
//
// This is deliberately NOT Univer's `IWorkbookData`. The document arrives from
// a browser and is therefore untrusted, so the module owns a narrow, closed
// subset it can actually validate and refuses everything outside it. Widening
// the format is a deliberate edit here plus a matching rule in
// `engine-validation.ts` — never a silent pass-through of a vendor field, and
// never a silent drop of a user's data.
//
// Note what is absent: `custom`. Univer's own documentation does not recommend
// that field for external use, and contract 3 puts source-row identity in a
// server-owned layout instead, so a snapshot that tries to carry identity in a
// cell is refused rather than trusted.

import type { WorkbookRejectionWire } from "./engine-errors.ts";

/** A style entry, carried verbatim. Formatting never changes a calculated figure. */
export type WorkbookStyle = Readonly<Record<string, unknown>>;

/** What a cell can hold once calculated. `null` is empty, and is never a stand-in for 0. */
export type WorkbookCellValue = string | number | boolean | null;

/**
 * Univer's cell value types, restricted to the four this module accepts.
 * Kept as a plain union so an untrusted document is checked against it rather
 * than cast into the vendor enum.
 */
export const WORKBOOK_CELL_TYPES = [1, 2, 3, 4] as const;
export type WorkbookCellType = (typeof WORKBOOK_CELL_TYPES)[number];

export interface WorkbookCell {
  /** Literal value. Absent for a pure formula cell. */
  readonly v?: WorkbookCellValue;
  /** Raw formula text including the leading `=`. Never rewritten by this module. */
  readonly f?: string;
  /** Style id into the workbook's style table. */
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

/** What one cell is currently worth, with the formula that produced it. */
export interface CalculatedCell {
  readonly value: WorkbookCellValue;
  /** Formula text as stored, or `null` for a literal. */
  readonly formula: string | null;
}

export type CalculatedCellMatrix = Readonly<Record<string, Readonly<Record<string, CalculatedCell>>>>;

/**
 * Spreadsheet error codes, plus the one this module adds.
 *
 * `NON_FINITE` has no Excel equivalent: it is what a formula produced when the
 * engine returned a number that is not a real figure. It exists so such a cell
 * is reported as an error rather than rounded, coerced, or published as 0.
 */
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

export function isWorkbookErrorCode(value: string): value is WorkbookErrorCode {
  return (WORKBOOK_ERROR_CODES as readonly string[]).includes(value);
}

export interface WorkbookCellError {
  readonly sheetId: string;
  readonly row: number;
  readonly column: number;
  /** Formula that produced the error, or `null` when the cell holds a literal. */
  readonly formula: string | null;
  readonly code: WorkbookErrorCode;
}

export interface EvaluateWorkbookResult {
  /** The validated candidate, echoed. Formulas and literals are exactly as supplied. */
  readonly snapshot: WorkbookSnapshot;
  /** Sheet id -> row -> column -> current value. */
  readonly values: Readonly<Record<string, CalculatedCellMatrix>>;
  /** Cells whose formula did not produce a usable figure. Their value is `null`. */
  readonly errors: readonly WorkbookCellError[];
  readonly populatedCells: number;
  /** Wall clock from queue exit to settled results, including worker startup. */
  readonly durationMs: number;
}

// ---------- worker boundary ----------

export interface WorkbookJob {
  readonly jobId: string;
  readonly snapshot: WorkbookSnapshot;
  /** Budget handed to the engine's own settle and dependency calls. */
  readonly settleTimeoutMs: number;
  readonly maxGraphNodes: number;
  readonly maxGraphEdges: number;
  readonly maxReportedCycles: number;
}

export interface WorkbookJobSuccess {
  readonly values: Readonly<Record<string, CalculatedCellMatrix>>;
  readonly errors: readonly WorkbookCellError[];
  readonly populatedCells: number;
}

/** The single message a worker sends back before the parent terminates it. */
export type WorkbookWorkerMessage =
  | { readonly ok: true; readonly result: WorkbookJobSuccess }
  | { readonly ok: false; readonly rejection: WorkbookRejectionWire };
