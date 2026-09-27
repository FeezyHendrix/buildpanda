// The take-off workbook as an .xlsx file.
//
// This module does no arithmetic and reads no database. It is handed ONE
// already-coherent `WorkbookDocument` — the same one the API serves, whose
// values were recalculated from the live bill by `workbookService.read` — and
// turns it into bytes. That is deliberate: an exporter that recomputed anything
// would be a second implementation of the workbook's maths, and the two would
// eventually disagree about what a bill is worth. The file therefore says
// exactly what the screen says, or it is a bug in one shared path rather than
// a discrepancy between two.
//
// What the file carries, and why each matters:
//
//   * the STORED FORMULA TEXT, so the workbook stays a working document rather
//     than a printout of numbers nobody can defend;
//   * this read's FRESH RESULT as Excel's cached value, so a reader that does
//     not recalculate still sees today's figure;
//   * ERRORS AS ERRORS, so a withdrawn measurement reads `#REF!` and never 0.
//
// Refusals are bounded and explicit. A document too big to export is refused
// with the bound it broke, and a formula that would not survive the conversion
// is refused by NAME — never quietly replaced by the number it last produced,
// which is the one outcome that would put an unexplainable figure in a bill.

import ExcelJS from "exceljs";
import { rejectWorkbook } from "./engine-errors.ts";
import { WORKBOOK_LIMITS } from "./engine-limits.ts";
import { countPopulatedCells } from "./engine-validation.ts";
import { applyCellStyle, exportedCell } from "./export-cells.ts";
import { addCoverSheet, type WorkbookExportMeta } from "./export-cover.ts";
import { excelSheetNames, rewriteSheetRefs } from "./export-names.ts";
import { assertFormulaSupported } from "./formula-safety.ts";
import { uniqueSheetName } from "./layout.ts";
import type {
  CalculatedCellMatrix,
  WorkbookCell,
  WorkbookErrorCode,
  WorkbookSheet,
  WorkbookSnapshot,
} from "./engine-types.ts";
import type { WorkbookDocument, WorkbookField, WorkbookSheetLayout } from "./types.ts";

export type { WorkbookExportMeta } from "./export-cover.ts";

export const WORKBOOK_EXPORT_LIMITS = Object.freeze({
  /** The same ceiling a saved workbook is held to; an export writes no more than it holds. */
  maxCells: WORKBOOK_LIMITS.maxPopulatedCells,
  /** A download one request may produce. Past this the bill is split, not compressed. */
  maxBytes: 8 * 1024 * 1024,
});

/** Column widths for the generated block, so a bill opens readable rather than clipped. */
const FIELD_WIDTH: Readonly<Record<WorkbookField, number>> = Object.freeze({
  code: 12,
  description: 52,
  unit: 8,
  qty: 12,
  rate: 14,
  amount: 16,
  label: 34,
});

const FREE_COLUMN_WIDTH = 14;
const FREE_COLUMNS_SHOWN = 8;

const errorKey = (sheetId: string, row: number, column: number): string => `${sheetId}:${row}:${column}`;

function errorsByCell(document: WorkbookDocument): Map<string, WorkbookErrorCode> {
  return new Map(document.errors.map((error) => [errorKey(error.sheetId, error.row, error.column), error.code]));
}

function columnsFor(layout: WorkbookSheetLayout | undefined): Partial<ExcelJS.Column>[] {
  if (layout === undefined) return [];
  const widths: Partial<ExcelJS.Column>[] = [];
  for (const [index, field] of Object.entries(layout.columns)) {
    widths[Number(index)] = { width: FIELD_WIDTH[field] };
  }
  for (let index = layout.freeColumnStart; index < layout.freeColumnStart + FREE_COLUMNS_SHOWN; index += 1) {
    widths[index] = { width: FREE_COLUMN_WIDTH };
  }
  // A gap left by a layout that starts its free columns further right would be
  // `undefined`, which ExcelJS cannot take; the default width fills it.
  return [...widths].map((column) => column ?? { width: FREE_COLUMN_WIDTH });
}

/**
 * Refuse a formula this export could not honestly carry.
 *
 * Every allowed function is already a native Excel one — the save-time
 * allowlist in `formula-safety.ts` exists precisely so no unportable function
 * can be stored — so this should never fire. It is here because the failure it
 * guards is silent: without it, a formula Excel cannot evaluate would still be
 * written, carrying the cached number beside it, and the file would show a
 * figure with nothing behind it.
 */
function assertPortable(snapshot: WorkbookSnapshot): void {
  const names = new Set(snapshot.sheetOrder.map((id) => (snapshot.sheets[id]?.name ?? id).toLowerCase()));
  for (const sheetId of snapshot.sheetOrder) {
    const sheet = snapshot.sheets[sheetId];
    if (sheet === undefined) continue;
    for (const [row, line] of Object.entries(sheet.cellData)) {
      for (const [column, cell] of Object.entries(line)) {
        if (cell.f !== undefined) assertFormulaSupported(cell.f, `${sheet.name}!r${row}c${column}`, names);
      }
    }
  }
}

interface SheetExportContext {
  /** Lower-cased snapshot name -> exported name, for worksheets Excel made us rename. */
  readonly renamed: ReadonlyMap<string, string>;
  readonly styles: WorkbookSnapshot["styles"];
  readonly values: CalculatedCellMatrix;
  readonly errorAt: (row: number, column: number) => WorkbookErrorCode | undefined;
}

function writeSheetCells(sheet: ExcelJS.Worksheet, source: WorkbookSheet, context: SheetExportContext): void {
  for (const [row, line] of Object.entries(source.cellData)) {
    for (const [column, cell] of Object.entries(line)) {
      const pointed: WorkbookCell =
        cell.f === undefined ? cell : { ...cell, f: rewriteSheetRefs(cell.f, context.renamed) };
      const value = exportedCell(
        pointed,
        context.values[row]?.[column],
        context.errorAt(Number(row), Number(column)),
      );
      const target = sheet.getCell(Number(row) + 1, Number(column) + 1);
      if (value !== null) target.value = value;
      if (typeof cell.s === "string") applyCellStyle(target, context.styles[cell.s]);
    }
  }
}

export async function buildWorkbookXlsx(document: WorkbookDocument, meta: WorkbookExportMeta): Promise<Buffer> {
  const populated = countPopulatedCells(document.snapshot);
  if (populated > WORKBOOK_EXPORT_LIMITS.maxCells) {
    rejectWorkbook(
      "too_large",
      `this workbook holds ${populated} populated cells, more than the ${WORKBOOK_EXPORT_LIMITS.maxCells} one export may carry`,
    );
  }
  assertPortable(document.snapshot);

  const names = excelSheetNames(document.snapshot);
  const errors = errorsByCell(document);
  const layoutById = new Map(document.layout.sheets.map((sheet) => [sheet.sheetId, sheet]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BuildPanda";
  workbook.created = meta.generatedAt;
  // The cached results are this server's figures. Asking Excel to recalculate
  // on open means an edited cell flows through immediately, and means the two
  // never disagree for longer than it takes to open the file.
  workbook.calcProperties.fullCalcOnLoad = true;

  addCoverSheet(workbook, uniqueSheetName("Workbook details", names.taken), document, meta);

  for (const sheetId of document.snapshot.sheetOrder) {
    const source = document.snapshot.sheets[sheetId];
    if (source === undefined) continue;
    const layout = layoutById.get(sheetId);
    const sheet = workbook.addWorksheet(names.byId.get(sheetId) ?? sheetId);
    const widths = columnsFor(layout);
    if (widths.length > 0) sheet.columns = widths;
    if (layout && layout.firstBodyRow > 0) {
      sheet.views = [{ state: "frozen", ySplit: layout.firstBodyRow }];
    }

    writeSheetCells(sheet, source, {
      renamed: names.renamed,
      styles: document.snapshot.styles,
      values: document.values[sheetId] ?? {},
      errorAt: (row, column) => errors.get(errorKey(sheetId, row, column)),
    });
  }

  const buffer = Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
  if (buffer.byteLength > WORKBOOK_EXPORT_LIMITS.maxBytes) {
    rejectWorkbook(
      "too_large",
      `the exported file is ${buffer.byteLength} bytes, more than the ${WORKBOOK_EXPORT_LIMITS.maxBytes} one download may be`,
    );
  }
  return buffer;
}
