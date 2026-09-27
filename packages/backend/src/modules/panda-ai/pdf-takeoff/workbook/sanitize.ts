// The gate between a document a browser sent and a document this module will
// store.
//
// The engine's validator has already decided the candidate is a readable
// workbook. This decides whether it is an ALLOWED one — which is a different
// question, and the only one that protects a measured quantity.
//
// It works by comparison, not by inspection. The server renders what the
// generated block SHOULD say from the live rows, and every generated cell in
// the candidate must equal it. There is no list of "fields a client may not
// send" to keep in step with the schema, and no stripping: a candidate that
// disagrees anywhere is refused whole. Stripping would be worse than refusing,
// because the user would be told their paste succeeded while half of it was
// silently discarded.
//
// Three things are deliberately NOT compared:
//   * style ids — formatting never changes a figure, so a person may format
//     any cell, generated or not.
//   * anything at or right of the free column on a generated sheet.
//   * scratch worksheets entirely. They are the user's.

import { AppError } from "../../../../lib/errors.ts";
import { isGeneratedSheetId } from "./layout.ts";
import type { WorkbookCell, WorkbookSnapshot } from "./engine-types.ts";
import type { WorkbookLayout, WorkbookSheetLayout } from "./types.ts";

export interface WorkbookProtectedDetails {
  readonly at: string;
  readonly reason: string;
}

/**
 * Refused because it would have moved something the client does not own.
 * 422 rather than 403: the caller's role is not the problem — no role permits
 * typing over a measured quantity, and the fix is to resend without it.
 */
export class WorkbookProtectedError extends AppError {
  readonly at: string;

  constructor(at: string, reason: string) {
    super(
      `That change was refused because it would alter measured take-off data (${at}: ${reason}). ` +
        "Nothing was saved. Quantities come from the drawings; rates and descriptions change through the bill line itself.",
      { statusCode: 422, code: "workbook_protected", details: { at, reason } satisfies WorkbookProtectedDetails },
    );
    this.at = at;
  }
}

function refuse(at: string, reason: string): never {
  throw new WorkbookProtectedError(at, reason);
}

/** Value, formula and value-type. `s` is absent on purpose: formatting is the user's. */
function sameMeaning(a: WorkbookCell | undefined, b: WorkbookCell | undefined): boolean {
  const left = a ?? {};
  const right = b ?? {};
  return (
    (left.v ?? null) === (right.v ?? null) &&
    (left.f ?? null) === (right.f ?? null) &&
    (left.t ?? null) === (right.t ?? null)
  );
}

const describe = (cell: WorkbookCell | undefined): string => {
  if (cell === undefined) return "nothing";
  if (cell.f !== undefined) return `formula ${cell.f}`;
  return cell.v === undefined || cell.v === null ? "nothing" : JSON.stringify(cell.v);
};

function cellAt(snapshot: WorkbookSnapshot, sheetId: string, row: number, column: number): WorkbookCell | undefined {
  return snapshot.sheets[sheetId]?.cellData[String(row)]?.[String(column)];
}

type CellMatrix = Readonly<Record<string, Readonly<Record<string, WorkbookCell>>>>;

/**
 * Every protected address named by EITHER side, lowest row and column first.
 *
 * Sorted so the refusal a client is shown is the first offending cell in
 * reading order rather than whichever side happened to mention it first.
 */
function protectedAddresses(
  sheet: WorkbookSheetLayout,
  candidate: CellMatrix,
  trusted: CellMatrix,
): { row: number; column: number }[] {
  const addresses = new Map<string, { row: number; column: number }>();
  for (const matrix of [trusted, candidate]) {
    for (const [rowKey, line] of Object.entries(matrix)) {
      for (const columnKey of Object.keys(line)) {
        const column = Number(columnKey);
        if (column >= sheet.freeColumnStart) continue;
        addresses.set(`${rowKey}:${columnKey}`, { row: Number(rowKey), column });
      }
    }
  }
  return [...addresses.values()].sort((a, b) => a.row - b.row || a.column - b.column);
}

/** Rows of a generated sheet whose protected columns the server owns. */
function generatedRows(sheet: WorkbookSheetLayout): Set<number> {
  const rows = new Set<number>();
  for (let row = 0; row < sheet.firstBodyRow; row += 1) rows.add(row);
  for (const binding of sheet.bindings) rows.add(binding.gridRow);
  for (const slot of sheet.billSlots ?? []) rows.add(slot.gridRow);
  return rows;
}

function assertGeneratedSheetIntact(
  sheet: WorkbookSheetLayout,
  candidate: WorkbookSnapshot,
  trusted: WorkbookSnapshot,
): void {
  const at = `worksheet "${sheet.name}"`;
  const candidateSheet = candidate.sheets[sheet.sheetId];
  if (!candidateSheet) refuse(at, "a generated worksheet was removed from the workbook");
  if (candidateSheet.name !== sheet.name) {
    refuse(at, `a generated worksheet was renamed to "${candidateSheet.name}"`);
  }

  const trustedSheet = trusted.sheets[sheet.sheetId]!;
  const owned = generatedRows(sheet);

  // Against what the BILL needs, not against the rendered sheet: the rendered
  // sheet is this candidate plus working room, so comparing with it would
  // refuse every save that added a cell past the previous extent.
  const requiredRows = Math.max(...owned, sheet.firstBodyRow - 1) + 1;
  if (candidateSheet.rowCount < requiredRows || candidateSheet.columnCount < sheet.freeColumnStart) {
    refuse(at, `the worksheet was shrunk below the ${requiredRows} rows the bill needs`);
  }

  // Both sides, address by address. Scanning only the TRUSTED side would miss
  // the forgery that matters most: a bill line with no rate renders no rate
  // cell at all, so a candidate carrying `{v: 9999}` there sits at an address
  // the trusted render never mentions. It would pass unexamined and then be
  // dropped by the rebuild — the user told "saved" while part of their paste
  // was silently discarded, which is exactly what refusing whole exists to
  // prevent. An absent cell compares as blank, so a rightful empty still
  // matches an empty and nothing invents a zero.
  for (const { row, column } of protectedAddresses(sheet, candidateSheet.cellData, trustedSheet.cellData)) {
    const expected = cellAt(trusted, sheet.sheetId, row, column);
    const received = cellAt(candidate, sheet.sheetId, row, column);
    if (sameMeaning(expected, received)) continue;

    const where = `${sheet.name}!${row}:${column}`;
    if (!owned.has(row)) {
      refuse(
        where,
        "that cell is reserved for a bill line that has not been measured yet — " +
          `use column ${sheet.freeColumnStart} onwards for your own calculations`,
      );
    }
    const field = sheet.columns[String(column)] ?? "generated";
    refuse(where, `the ${field} is ${describe(expected)} but the workbook sent ${describe(received)}`);
  }
}

/**
 * Refuse the whole candidate unless every generated cell still agrees with the
 * live bill. `trusted` is what this server would render right now, including
 * any rate or description the same save is about to apply.
 */
export function sanitizeCandidate(candidate: WorkbookSnapshot, layout: WorkbookLayout, trusted: WorkbookSnapshot): void {
  for (const sheet of layout.sheets) {
    if (sheet.kind === "scratch") continue;
    assertGeneratedSheetIntact(sheet, candidate, trusted);
  }

  const generatedIds = new Set(layout.sheets.filter((sheet) => sheet.kind !== "scratch").map((sheet) => sheet.sheetId));
  for (const sheetId of candidate.sheetOrder) {
    if (generatedIds.has(sheetId)) continue;
    if (isGeneratedSheetId(sheetId)) {
      refuse(`worksheet "${sheetId}"`, "that worksheet id is reserved for a generated bill");
    }
  }
}
