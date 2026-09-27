// One workbook cell, as ExcelJS wants it.
//
// Three rules decide everything in this file, and all three are about not
// inventing a figure:
//
//   1. A FORMULA CELL exports its stored formula text plus the value this
//      server just calculated, as Excel's cached result. The text is what the
//      QS wrote; the number beside it is what it is worth right now. Neither is
//      derived from the other here — no arithmetic happens in this module.
//   2. AN ERROR EXPORTS AS AN ERROR. `#REF!` reaches the spreadsheet as
//      `#REF!`, never as 0 and never as blank, because a withdrawn measurement
//      showing 0 is a bill that silently under-claims.
//   3. AN ABSENT FIGURE STAYS ABSENT. An unpriced line has no rate cell at all;
//      writing 0 there would price it, and writing `false` would be worse.
//
// Formatting is carried as an explicit subset of Univer's style keys rather
// than passed through, because a style the grid ignores must not become a style
// Excel obeys. Anything outside the subset is dropped, never guessed at.

import type { CalculatedCell, WorkbookCell, WorkbookCellValue, WorkbookErrorCode, WorkbookStyle } from "./engine-types.ts";
import type ExcelJS from "exceljs";

/**
 * `NON_FINITE` is this module's own code, not a spreadsheet one: it is what the
 * engine reports when a formula produced a number that is not a real figure.
 * Excel expresses that same outcome as `#NUM!`, so that is what the file says.
 * Every other code is a genuine Excel error and travels unchanged.
 */
const EXCEL_ERROR: Readonly<Record<WorkbookErrorCode, string>> = Object.freeze({
  "#DIV/0!": "#DIV/0!",
  "#N/A": "#N/A",
  "#NAME?": "#NAME?",
  "#NULL!": "#NULL!",
  "#NUM!": "#NUM!",
  "#REF!": "#REF!",
  "#VALUE!": "#VALUE!",
  "#SPILL!": "#SPILL!",
  "#CALC!": "#CALC!",
  NON_FINITE: "#NUM!",
});

/**
 * The one cast in this module, and the reason for it: ExcelJS's `CellErrorValue`
 * union predates dynamic arrays and so omits `#SPILL!` and `#CALC!`, which are
 * real Excel errors its writer round-trips verbatim (confirmed by writing and
 * re-reading a buffer). Widening them to `#VALUE!` to satisfy the union would
 * silently restate one error as a different one, which is worse than the cast.
 */
export const excelError = (code: WorkbookErrorCode): ExcelJS.CellErrorValue =>
  ({ error: EXCEL_ERROR[code] }) as ExcelJS.CellErrorValue;

/** Univer's FORCE_STRING: the person meant the text, even where it reads as a number. */
const FORCE_STRING = 4;

function literalOf(cell: WorkbookCell): ExcelJS.CellValue {
  const value: WorkbookCellValue = cell.v ?? null;
  if (value === null) return null;
  if (cell.t === FORCE_STRING) return String(value);
  return value;
}

export interface ExportedCell {
  readonly value: ExcelJS.CellValue;
  readonly style: WorkbookStyle | undefined;
}

/**
 * What one cell becomes in the file.
 *
 * `calculated` is this read's fresh result and `error` its code when the
 * formula did not produce a figure. A formula whose result is neither — an
 * empty cell the engine had nothing to say about — is written WITHOUT a cached
 * value rather than with an invented one, so Excel computes it on open and no
 * reader is shown a number this server never stood behind.
 */
export function exportedCell(
  cell: WorkbookCell,
  calculated: CalculatedCell | undefined,
  error: WorkbookErrorCode | undefined,
): ExcelJS.CellValue {
  if (cell.f === undefined) return literalOf(cell);

  const formula = cell.f.startsWith("=") ? cell.f.slice(1) : cell.f;
  if (error !== undefined) return { formula, result: excelError(error) };

  const result = calculated?.value ?? null;
  return result === null ? { formula } : { formula, result };
}

// ------------------------------------------------------------------- styles

const rgb = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `FF${hex.toUpperCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) return `FF${[...hex].map((c) => c + c).join("").toUpperCase()}`;
  if (/^[0-9a-fA-F]{8}$/.test(hex)) return hex.toUpperCase();
  return null;
};

const colourOf = (entry: unknown): string | null =>
  typeof entry === "object" && entry !== null ? rgb((entry as { rgb?: unknown }).rgb) : null;

/** Univer carries underline and strikethrough as `{ s: 0 | 1 }`, not as a flag. */
const switchedOn = (entry: unknown): boolean =>
  typeof entry === "object" && entry !== null && (entry as { s?: unknown }).s === 1;

const HORIZONTAL: Readonly<Record<number, ExcelJS.Alignment["horizontal"]>> = Object.freeze({
  1: "left",
  2: "center",
  3: "right",
  4: "justify",
});

const VERTICAL: Readonly<Record<number, ExcelJS.Alignment["vertical"]>> = Object.freeze({
  1: "top",
  2: "middle",
  3: "bottom",
});

/** Univer's WrapStrategy. Only WRAP changes how Excel lays the text out. */
const WRAP = 3;

function fontOf(style: WorkbookStyle): Partial<ExcelJS.Font> | null {
  const font: Partial<ExcelJS.Font> = {};
  if (style["bl"] === 1) font.bold = true;
  if (style["it"] === 1) font.italic = true;
  if (switchedOn(style["ul"])) font.underline = true;
  if (switchedOn(style["st"])) font.strike = true;
  if (typeof style["fs"] === "number" && style["fs"] > 0) font.size = style["fs"];
  if (typeof style["ff"] === "string" && style["ff"].length > 0) font.name = style["ff"];
  const colour = colourOf(style["cl"]);
  if (colour !== null) font.color = { argb: colour };
  return Object.keys(font).length > 0 ? font : null;
}

function alignmentOf(style: WorkbookStyle): Partial<ExcelJS.Alignment> | null {
  const alignment: Partial<ExcelJS.Alignment> = {};
  const horizontal = typeof style["ht"] === "number" ? HORIZONTAL[style["ht"]] : undefined;
  const vertical = typeof style["vt"] === "number" ? VERTICAL[style["vt"]] : undefined;
  if (horizontal) alignment.horizontal = horizontal;
  if (vertical) alignment.vertical = vertical;
  if (style["tb"] === WRAP) alignment.wrapText = true;
  return Object.keys(alignment).length > 0 ? alignment : null;
}

/** The formatting subset the exported file carries. Everything else is dropped. */
export function applyCellStyle(cell: ExcelJS.Cell, style: WorkbookStyle | undefined): void {
  if (style === undefined) return;

  const font = fontOf(style);
  if (font) cell.font = font as ExcelJS.Font;

  const alignment = alignmentOf(style);
  if (alignment) cell.alignment = alignment as ExcelJS.Alignment;

  const background = colourOf(style["bg"]);
  if (background !== null) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: background } };
  }

  const numberFormat = style["n"];
  if (typeof numberFormat === "object" && numberFormat !== null) {
    const pattern = (numberFormat as { pattern?: unknown }).pattern;
    if (typeof pattern === "string" && pattern.length > 0) cell.numFmt = pattern;
  }
}
