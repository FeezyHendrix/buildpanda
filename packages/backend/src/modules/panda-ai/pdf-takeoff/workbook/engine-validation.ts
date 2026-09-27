// Turning an untrusted document into a workbook this module will calculate.
//
// Parse, don't validate: the result is a `WorkbookSnapshot` whose every field
// has already been checked, so nothing downstream — worker included — re-reads
// an `unknown`. A candidate that does not survive this function never reaches
// a queue slot, a thread, or Univer.
//
// Worksheet names are read in a first pass because a cross-sheet formula can
// only be checked against the full set of names, and `=Missing!A1` has to be a
// refusal rather than a `#REF!` discovered after a worker has been paid for.

import { rejectWorkbook } from "./engine-errors.ts";
import { WORKBOOK_LIMITS, type WorkbookLimits } from "./engine-limits.ts";
import { validateCellMatrix } from "./engine-cells.ts";
import {
  assertOnlyKeys,
  measureBytes,
  readBoundedCount,
  readNonEmptyString,
  readObject,
  readString,
} from "./engine-parse.ts";
import type { WorkbookSheet, WorkbookSnapshot, WorkbookStyle } from "./engine-types.ts";

const WORKBOOK_KEYS = ["id", "name", "sheetOrder", "sheets", "styles"] as const;
const SHEET_KEYS = ["id", "name", "rowCount", "columnCount", "cellData"] as const;

interface SheetHeader {
  readonly id: string;
  readonly name: string;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly rawCellData: unknown;
}

function readStyles(raw: unknown, limits: WorkbookLimits): Readonly<Record<string, WorkbookStyle>> {
  if (raw === undefined || raw === null) return Object.freeze({});
  const source = readObject(raw, "workbook.styles");
  const keys = Object.keys(source);
  if (keys.length > limits.maxStyles) {
    rejectWorkbook("too_large", `workbook declares ${keys.length} styles (max ${limits.maxStyles})`);
  }
  const styles: Record<string, WorkbookStyle> = {};
  for (const key of keys) {
    readString(key, "workbook.styles key", limits.maxIdentifierLength);
    // Formatting never changes a calculated figure, so a style is carried
    // verbatim rather than modelled. It is still bounded, and still an object.
    styles[key] = Object.freeze(readObject(source[key], `workbook.styles["${key}"]`));
  }
  return Object.freeze(styles);
}

function readSheetOrder(raw: unknown, limits: WorkbookLimits): string[] {
  if (!Array.isArray(raw)) rejectWorkbook("invalid_snapshot", "workbook.sheetOrder must be an array");
  if (raw.length === 0) rejectWorkbook("invalid_snapshot", "workbook.sheetOrder must name at least one worksheet");
  if (raw.length > limits.maxSheets) {
    rejectWorkbook("too_large", `workbook has ${raw.length} worksheets (max ${limits.maxSheets})`);
  }
  const order: string[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of raw.entries()) {
    const id = readNonEmptyString(entry, `workbook.sheetOrder[${index}]`, limits.maxIdentifierLength);
    if (seen.has(id)) rejectWorkbook("invalid_snapshot", `workbook.sheetOrder lists "${id}" twice`);
    seen.add(id);
    order.push(id);
  }
  return order;
}

function readSheetHeader(raw: unknown, id: string, limits: WorkbookLimits): SheetHeader {
  const at = `workbook.sheets["${id}"]`;
  const source = readObject(raw, at);
  assertOnlyKeys(source, SHEET_KEYS, at);
  const declaredId = readNonEmptyString(source.id, `${at}.id`, limits.maxIdentifierLength);
  if (declaredId !== id) {
    rejectWorkbook("invalid_snapshot", `${at}.id is "${declaredId}" but the worksheet is keyed "${id}"`, { at });
  }
  return {
    id,
    name: readNonEmptyString(source.name, `${at}.name`, limits.maxTextLength),
    rowCount: readBoundedCount(source.rowCount, `${at}.rowCount`, limits.maxRowCount),
    columnCount: readBoundedCount(source.columnCount, `${at}.columnCount`, limits.maxColumnCount),
    rawCellData: source.cellData,
  };
}

/** `sheetOrder` and `sheets` must describe the same worksheets, in both directions. */
function assertSheetsMatchOrder(sheets: Record<string, unknown>, order: readonly string[]): void {
  const ordered = new Set(order);
  for (const id of order) {
    if (!(id in sheets)) {
      rejectWorkbook("invalid_snapshot", `workbook.sheetOrder names "${id}" but workbook.sheets has no such worksheet`);
    }
  }
  for (const id of Object.keys(sheets)) {
    if (!ordered.has(id)) {
      rejectWorkbook("invalid_snapshot", `workbook.sheets holds "${id}", which workbook.sheetOrder does not name`);
    }
  }
}

export function validateWorkbookSnapshot(input: unknown, limits: WorkbookLimits = WORKBOOK_LIMITS): WorkbookSnapshot {
  measureBytes(input, limits.maxInputBytes);

  const source = readObject(input, "workbook");
  assertOnlyKeys(source, WORKBOOK_KEYS, "workbook");
  const id = readNonEmptyString(source.id, "workbook.id", limits.maxIdentifierLength);
  const name =
    source.name === undefined
      ? "Workbook"
      : readNonEmptyString(source.name, "workbook.name", limits.maxTextLength);

  const styles = readStyles(source.styles, limits);
  const styleIds = new Set(Object.keys(styles));
  const sheetOrder = readSheetOrder(source.sheetOrder, limits);
  const sheetsSource = readObject(source.sheets, "workbook.sheets");
  assertSheetsMatchOrder(sheetsSource, sheetOrder);

  const headers = sheetOrder.map((sheetId) => readSheetHeader(sheetsSource[sheetId], sheetId, limits));

  const sheetNames = new Set<string>();
  for (const header of headers) {
    const key = header.name.toLowerCase();
    if (sheetNames.has(key)) {
      rejectWorkbook(
        "invalid_snapshot",
        `two worksheets are both named "${header.name}", so a cross-sheet formula could not say which it means`,
      );
    }
    sheetNames.add(key);
  }

  const sheets: Record<string, WorkbookSheet> = {};
  let cellBudget = limits.maxPopulatedCells;
  for (const header of headers) {
    const { cellData, populated } = validateCellMatrix(header.rawCellData, {
      sheetId: header.id,
      rowCount: header.rowCount,
      columnCount: header.columnCount,
      limits,
      styleIds,
      sheetNames,
      cellBudget,
    });
    cellBudget -= populated;
    sheets[header.id] = Object.freeze({
      id: header.id,
      name: header.name,
      rowCount: header.rowCount,
      columnCount: header.columnCount,
      cellData,
    });
  }

  return Object.freeze({
    id,
    name,
    sheetOrder: Object.freeze(sheetOrder),
    sheets: Object.freeze(sheets),
    styles,
  });
}

/** Cells carrying anything at all, across every worksheet. */
export function countPopulatedCells(snapshot: WorkbookSnapshot): number {
  let total = 0;
  for (const sheetId of snapshot.sheetOrder) {
    const sheet = snapshot.sheets[sheetId];
    if (sheet === undefined) continue;
    for (const row of Object.values(sheet.cellData)) total += Object.keys(row).length;
  }
  return total;
}
