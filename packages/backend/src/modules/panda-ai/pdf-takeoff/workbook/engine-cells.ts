// Validating one worksheet's cell matrix.
//
// This is where the populated-cell budget is actually spent, so it is checked
// as the walk proceeds rather than after it: a document that claims a million
// cells is refused on the ten-thousand-and-first, not once all million have
// been read into a new object.

import { rejectWorkbook } from "./engine-errors.ts";
import type { WorkbookLimits } from "./engine-limits.ts";
import { assertOnlyKeys, readIndexKey, readObject, readString } from "./engine-parse.ts";
import {
  WORKBOOK_CELL_TYPES,
  type WorkbookCell,
  type WorkbookCellMatrix,
  type WorkbookCellType,
  type WorkbookCellValue,
} from "./engine-types.ts";
import { assertFormulaSupported } from "./formula-safety.ts";

const CELL_KEYS = ["v", "f", "s", "t"] as const;

export interface CellMatrixContext {
  readonly sheetId: string;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly limits: WorkbookLimits;
  /** Style ids declared by the workbook. A cell may not point outside them. */
  readonly styleIds: ReadonlySet<string>;
  /** Lower-cased worksheet names of this workbook, for cross-sheet references. */
  readonly sheetNames: ReadonlySet<string>;
  /** Cells still available across the whole workbook when this sheet starts. */
  readonly cellBudget: number;
}

export interface CellMatrixResult {
  readonly cellData: WorkbookCellMatrix;
  readonly populated: number;
}

/**
 * A literal. `Infinity` and `NaN` are refused rather than stored: JSON cannot
 * carry them, but an in-process caller can, and a workbook that holds one
 * would read back out of the engine looking like a real figure.
 */
function readCellValue(value: unknown, at: string, limits: WorkbookLimits): WorkbookCellValue {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      rejectWorkbook("invalid_snapshot", `${at} is ${String(value)}, which is not a usable figure`, { at });
    }
    return value;
  }
  if (typeof value === "string") return readString(value, at, limits.maxTextLength);
  rejectWorkbook("invalid_snapshot", `${at} must be a string, number, boolean or null`, { at });
}

function readCellType(value: unknown, at: string): WorkbookCellType {
  for (const candidate of WORKBOOK_CELL_TYPES) {
    if (value === candidate) return candidate;
  }
  rejectWorkbook("invalid_snapshot", `${at} must be one of ${WORKBOOK_CELL_TYPES.join(", ")}`, { at });
}

function readCell(raw: unknown, at: string, ctx: CellMatrixContext): WorkbookCell {
  const source = readObject(raw, at);
  assertOnlyKeys(source, CELL_KEYS, at);

  const cell: { v?: WorkbookCellValue; f?: string; s?: string; t?: WorkbookCellType } = {};

  // Univer writes `f: null` for "this cell has no formula", which is not the
  // same thing as a cell offering formula text that has to be checked.
  const hasFormula = "f" in source && source.f !== null && source.f !== undefined;

  // A FORMULA CELL'S VALUE IS DROPPED, and this is load-bearing.
  //
  // A grid snapshot carries both the formula and the number last shown for it,
  // so a client legitimately sends `{f:"=D2*2", v:88}`. Univer then RETURNS
  // THE 88 instead of evaluating — measured empirically: `=A1*2` over `A1=5`
  // comes back as 999 when the cell carries `v:999`. Keeping the value would
  // therefore let a client pin a cell forever: the formula would stop tracking
  // the bill, silently, and every read — the API, an export, an assistant —
  // would repeat the pinned figure as if the formula had produced it.
  //
  // Dropping it loses nothing. The formula is what the person wrote and the
  // engine is what decides its worth; the value is recomputed on the same call.
  // Parsing it out here rather than refusing the document keeps the
  // GET-edit-save round trip working with the snapshot a grid actually emits.
  if (!hasFormula && "v" in source && source.v !== undefined) {
    cell.v = readCellValue(source.v, `${at}.v`, ctx.limits);
  }
  if (hasFormula) {
    const formula = readString(source.f, `${at}.f`, ctx.limits.maxFormulaLength);
    assertFormulaSupported(formula, at, ctx.sheetNames);
    cell.f = formula;
  }
  if ("s" in source && source.s !== null && source.s !== undefined) {
    const styleId = readString(source.s, `${at}.s`, ctx.limits.maxIdentifierLength);
    if (!ctx.styleIds.has(styleId)) {
      rejectWorkbook("invalid_snapshot", `${at}.s points at style "${styleId}", which this workbook does not declare`, {
        at,
      });
    }
    cell.s = styleId;
  }
  if ("t" in source && source.t !== null && source.t !== undefined) {
    cell.t = readCellType(source.t, `${at}.t`);
  }

  return Object.freeze(cell);
}

export function validateCellMatrix(raw: unknown, ctx: CellMatrixContext): CellMatrixResult {
  const at = `${ctx.sheetId}.cellData`;
  const source = readObject(raw, at);
  const cellData: Record<string, Record<string, WorkbookCell>> = {};
  let populated = 0;

  for (const rowKey of Object.keys(source)) {
    const row = readIndexKey(rowKey, `${at}[${rowKey}]`, ctx.rowCount);
    const rowSource = readObject(source[rowKey], `${at}[${row}]`);
    const columns: Record<string, WorkbookCell> = {};

    for (const columnKey of Object.keys(rowSource)) {
      const column = readIndexKey(columnKey, `${at}[${row}][${columnKey}]`, ctx.columnCount);
      populated += 1;
      if (populated > ctx.cellBudget) {
        rejectWorkbook(
          "too_large",
          `workbook exceeds the populated-cell limit of ${ctx.limits.maxPopulatedCells}. ` +
            "Split the workbook across fewer cells or fewer worksheets.",
          { at },
        );
      }
      columns[String(column)] = readCell(rowSource[columnKey], `${ctx.sheetId}!r${row}c${column}`, ctx);
    }

    cellData[String(row)] = Object.freeze(columns);
  }

  return { cellData: Object.freeze(cellData), populated };
}
