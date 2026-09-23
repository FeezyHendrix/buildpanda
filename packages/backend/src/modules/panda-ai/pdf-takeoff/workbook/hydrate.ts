// Rendering the current bill into the grid, and putting the user's own work
// back around it.
//
// Generated cells are REBUILT from the live rows on every read and every save.
// They are never carried over from the stored snapshot, because a stored
// generated cell is a cached quantity — and a cached quantity is the thing that
// eventually gets shown as current after the drawing it came from changed.
//
// A withdrawn line's whole generated block becomes `=#REF!`. Not a blank, not
// its last known figure: a formula that depended on that quantity has to break
// loudly, and it has to break through the engine's own error, so the cell is
// reported with the same `#REF!` any spreadsheet would give it.

import { num } from "../dto.ts";
import { billSheetIdFor, BILL_FREE_COLUMN_START } from "./layout.ts";
import type { WorkbookCell, WorkbookCellMatrix, WorkbookSheet, WorkbookSnapshot } from "./engine-types.ts";
import type { WorkbookField, WorkbookLayout, WorkbookSheetLayout } from "./types.ts";
import type { PreconBoqRowRow } from "../types.ts";

/** Every generated column of a withdrawn slot. The engine, not this module, makes it an error. */
const REF_ERROR: WorkbookCell = Object.freeze({ f: "=#REF!" });

const text = (value: string): WorkbookCell => ({ v: value, t: 1 });
const number = (value: number): WorkbookCell => ({ v: value, t: 2 });
const formula = (value: string): WorkbookCell => ({ f: value });

const A1_ALPHABET_SIZE = 26;

export function columnLetter(index: number): string {
  let remaining = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (remaining % A1_ALPHABET_SIZE)) + letters;
    remaining = Math.floor(remaining / A1_ALPHABET_SIZE) - 1;
  } while (remaining >= 0);
  return letters;
}

/** Always quoted, apostrophes doubled: a bill titled `Bob's` must still be referable. */
export function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

/** `WORKBOOK_LIMITS.maxFormulaLength`. A generated total must not exceed what the engine accepts. */
const MAX_FORMULA_LENGTH = 4096;

function contiguousRanges(rows: readonly number[]): [number, number][] {
  const ranges: [number, number][] = [];
  for (const row of [...rows].sort((a, b) => a - b)) {
    const last = ranges[ranges.length - 1];
    if (last && row === last[1] + 1) last[1] = row;
    else ranges.push([row, row]);
  }
  return ranges;
}

/**
 * A total over exactly the live slots, skipping tombstones.
 *
 * A withdrawn line's amount is `=#REF!`, and one `#REF!` anywhere inside a
 * range makes the whole SUM `#REF!` — which is right for a USER's formula (they
 * were pricing off a line that is no longer on the bill, and must be told) but
 * wrong for the generated total, which would then report nothing at all just
 * because one line was withdrawn. So the server, which knows which slots are
 * live, sums the live runs: `=SUM(F2:F3,F5:F9)`.
 *
 * Past the engine's formula-length cap — thousands of alternating tombstones —
 * it degrades to the full span, which shows `#REF!`. Loud, and never a wrong
 * figure.
 */
function sumOfRows(column: number, rows: readonly number[], prefix: string): WorkbookCell {
  const ranges = contiguousRanges(rows);
  // The sum of no lines is zero, and `=SUM()` with no arguments is `#N/A`.
  if (ranges.length === 0) return number(0);
  const letter = columnLetter(column);
  const range = ([from, to]: [number, number]): string => `${prefix}${letter}${from + 1}:${letter}${to + 1}`;
  const full = `=SUM(${ranges.map(range).join(",")})`;
  if (full.length <= MAX_FORMULA_LENGTH) return formula(full);
  return formula(`=SUM(${range([ranges[0]![0], ranges[ranges.length - 1]![1]])})`);
}

function columnOf(sheet: WorkbookSheetLayout, field: WorkbookField): number {
  const entry = Object.entries(sheet.columns).find(([, name]) => name === field);
  if (entry === undefined) throw new Error(`worksheet "${sheet.name}" has no ${field} column`);
  return Number(entry[0]);
}

type MutableMatrix = Record<string, Record<string, WorkbookCell>>;

function put(matrix: MutableMatrix, row: number, column: number, cell: WorkbookCell): void {
  const key = String(row);
  const line = matrix[key] ?? (matrix[key] = {});
  line[String(column)] = cell;
}

const COLUMN_HEADINGS: Readonly<Record<WorkbookField, string>> = Object.freeze({
  code: "Code",
  description: "Description",
  unit: "Unit",
  qty: "Qty",
  rate: "Rate",
  amount: "Amount",
  label: "",
});

function billBodyCells(sheet: WorkbookSheetLayout, rows: ReadonlyMap<string, PreconBoqRowRow>): MutableMatrix {
  const matrix: MutableMatrix = {};
  for (const [column, field] of Object.entries(sheet.columns)) {
    put(matrix, 0, Number(column), text(COLUMN_HEADINGS[field]));
  }

  for (const binding of sheet.bindings) {
    const row = binding.state === "bound" ? rows.get(binding.rowId) : undefined;
    if (!row) {
      for (const column of Object.keys(sheet.columns)) put(matrix, binding.gridRow, Number(column), REF_ERROR);
      continue;
    }
    const literals: Readonly<Record<string, WorkbookCell | null>> = {
      code: text(row.code ?? ""),
      description: text(row.description),
      unit: text(row.unit ?? ""),
      qty: num(row.qty) === null ? null : number(num(row.qty)!),
      rate: num(row.rate) === null ? null : number(num(row.rate)!),
      amount: num(row.amount) === null ? null : number(num(row.amount)!),
    };
    for (const [column, field] of Object.entries(sheet.columns)) {
      const cell = literals[field];
      if (cell) put(matrix, binding.gridRow, Number(column), cell);
    }
  }
  return matrix;
}

function summaryCells(layout: WorkbookLayout, summary: WorkbookSheetLayout): MutableMatrix {
  const matrix: MutableMatrix = {};
  const sheetById = new Map(layout.sheets.map((sheet) => [sheet.sheetId, sheet]));
  const slots = summary.billSlots ?? [];

  put(matrix, 1, 0, text("Bill"));
  put(matrix, 1, 1, text("Amount"));

  for (const slot of slots) {
    put(matrix, slot.gridRow, 0, text(slot.label));
    const sheet = sheetById.get(billSheetIdFor(slot.billId));
    if (slot.state !== "bound" || sheet === undefined) {
      put(matrix, slot.gridRow, 1, REF_ERROR);
      continue;
    }
    const liveRows = sheet.bindings.filter((b) => b.state === "bound").map((b) => b.gridRow);
    put(matrix, slot.gridRow, 1, sumOfRows(columnOf(sheet, "amount"), liveRows, `${quoteSheetName(sheet.name)}!`));
  }

  put(matrix, 0, 0, text("Measured total"));
  const liveSlots = slots.filter((slot) => slot.state === "bound").map((slot) => slot.gridRow);
  put(matrix, 0, 1, sumOfRows(1, liveSlots, ""));
  return matrix;
}

/** The user's cells on a generated sheet: everything at or right of the free column. */
function freeCellsOf(sheet: WorkbookSheetLayout, existing: WorkbookSheet | undefined): MutableMatrix {
  const matrix: MutableMatrix = {};
  if (!existing) return matrix;
  for (const [rowKey, line] of Object.entries(existing.cellData)) {
    for (const [columnKey, cell] of Object.entries(line)) {
      if (Number(columnKey) < sheet.freeColumnStart) continue;
      put(matrix, Number(rowKey), Number(columnKey), cell);
    }
  }
  return matrix;
}

function merge(generated: MutableMatrix, free: MutableMatrix): WorkbookCellMatrix {
  const merged: MutableMatrix = {};
  for (const [rowKey, line] of Object.entries(generated)) merged[rowKey] = { ...line };
  for (const [rowKey, line] of Object.entries(free)) merged[rowKey] = { ...merged[rowKey], ...line };
  return merged as WorkbookCellMatrix;
}

function extentOf(matrix: WorkbookCellMatrix): { rows: number; columns: number } {
  let rows = 0;
  let columns = 0;
  for (const [rowKey, line] of Object.entries(matrix)) {
    rows = Math.max(rows, Number(rowKey) + 1);
    for (const columnKey of Object.keys(line)) columns = Math.max(columns, Number(columnKey) + 1);
  }
  return { rows, columns };
}

/** Enough grid to show the content, plus room to work in. Never smaller than what exists. */
const SPARE_ROWS = 50;
const SPARE_COLUMNS = 8;

export interface HydrateInput {
  readonly workbookId: string;
  readonly workbookName: string;
  readonly layout: WorkbookLayout;
  /** Live bill lines by id, already carrying any patch this save is applying. */
  readonly rows: ReadonlyMap<string, PreconBoqRowRow>;
  /** The user's document, sanitized. `null` builds the deterministic first draft. */
  readonly user: WorkbookSnapshot | null;
}

export function hydrateWorkbook({ workbookId, workbookName, layout, rows, user }: HydrateInput): WorkbookSnapshot {
  const sheets: Record<string, WorkbookSheet> = {};
  const sheetOrder: string[] = [];

  for (const sheet of layout.sheets) {
    const existing = user?.sheets[sheet.sheetId];
    const cellData =
      sheet.kind === "scratch"
        ? (existing?.cellData ?? {})
        : merge(
            sheet.kind === "summary" ? summaryCells(layout, sheet) : billBodyCells(sheet, rows),
            freeCellsOf(sheet, existing),
          );

    const extent = extentOf(cellData);
    sheets[sheet.sheetId] = {
      id: sheet.sheetId,
      name: sheet.name,
      rowCount: Math.max(existing?.rowCount ?? 0, extent.rows + SPARE_ROWS),
      columnCount: Math.max(
        existing?.columnCount ?? 0,
        extent.columns + SPARE_COLUMNS,
        sheet.kind === "bill" ? BILL_FREE_COLUMN_START + SPARE_COLUMNS : 0,
      ),
      cellData,
    };
    sheetOrder.push(sheet.sheetId);
  }

  return {
    id: workbookId,
    name: workbookName,
    sheetOrder,
    sheets,
    styles: user?.styles ?? {},
  };
}
