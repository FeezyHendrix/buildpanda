import type ExcelJS from "exceljs";
import type { PreconBoqRowDto } from "./types.ts";

// The take-off workbook is a working document, not a printout: quantities
// and amounts are formulas over the gross, deduction, typical and rate cells
// so a QS can adjust a figure and watch the bill follow.

/** Bill-sheet column numbers; the summary sheet shares the layout so amounts line up. */
export const COL = { sn: 1, description: 2, gross: 3, deduct: 4, typical: 5, qty: 6, unit: 7, rate: 8, amount: 9 } as const;

export const round2 = (v: number): number => Math.round(v * 100) / 100;

export function columnLetter(col: number): string {
  let out = "";
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(64 + ((n - 1) % 26) + 1) + out;
  return out;
}

export const cellRef = (col: number, row: number): string => `${columnLetter(col)}${row}`;

/** Cross-sheet reference; a quote inside the sheet name is doubled, as Excel expects. */
export const sheetRef = (sheetName: string, ref: string): string => `'${sheetName.replace(/'/g, "''")}'!${ref}`;

/** "SUM(I5:I7,I9)": consecutive rows fold into ranges so a long bill stays under Excel's argument limit. */
export function sumRefs(col: number, rows: number[]): string {
  if (!rows.length) return "0";
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  const runs: string[] = [];
  let start = sorted[0]!;
  let prev = start;
  const flush = (): void => {
    runs.push(start === prev ? cellRef(col, start) : `${cellRef(col, start)}:${cellRef(col, prev)}`);
  };
  for (const r of sorted.slice(1)) {
    if (r === prev + 1) {
      prev = r;
      continue;
    }
    flush();
    start = r;
    prev = r;
  }
  flush();
  return `SUM(${runs.join(",")})`;
}

/** A formula cell with its cached result, so readers that do not recalculate still see the number. */
export const formula = (expression: string, result: number): ExcelJS.CellFormulaValue => ({ formula: expression, result });

// WS-M2A adds a `typical` column to the row; until it lands the row carries
// none and the multiplier is 1, which is also what the maths expects.
export const typicalOf = (row: PreconBoqRowDto): number => {
  const raw = (row as { typical?: unknown }).typical;
  const n = typeof raw === "number" ? raw : Number(raw ?? 1);
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

export const deductionsOf = (row: PreconBoqRowDto): number => round2((row.deductions ?? []).reduce((s, d) => s + (Number(d.qty) || 0), 0));

export const grossOf = (row: PreconBoqRowDto): number | null => row.qtyGross ?? row.qty;
