// What Panda AI may say about a persisted workbook.
//
// The hard constraint, and the reason this is a separate read rather than a
// call into `workbookService.read`: THE ASSISTANT MUST NOT CALCULATE. A read
// that recalculated would spawn a Univer worker per workbook inside a chat
// turn — a hidden fan-out behind a question, against a queue of depth 8 and a
// 15-second deadline shared with the people actually editing. So this read is
// SQL only.
//
// That decides what can honestly be reported, and the line is sharp:
//
//   * A FORMULA is persisted text a person wrote. Always current, always
//     reportable — and it is the thing a PM is actually asking about when they
//     ask why a cell says what it says.
//   * A LITERAL a person typed into their own cell is persisted user data,
//     exactly like a rate. Current by definition.
//   * A CALCULATED FIGURE is not reported AT ALL. The stored snapshot does
//     carry numbers — the generated block as it stood at the last save, and
//     whatever `v` a client happened to send beside a formula — and every one
//     of them is a figure from a past moment. Quoting one would be the exact
//     failure contract 6 forbids: a stale cache described as current. Live
//     quantities and amounts reach the assistant through `get_precon_boq`'s
//     bill lines, which are read from the rows themselves.
//
// What CAN be said about a result without calculating is whether it is broken:
// a slot whose bill line has been withdrawn renders `#REF!` structurally, and
// that is reported as a labelled error rather than as a number.

import { columnLetter } from "./hydrate.ts";
import { liveRowsById, reviewRollup } from "./document.ts";
import { sourceFingerprint } from "./fingerprint.ts";
import { readCoherentState } from "./source.ts";
import type { Knex } from "knex";
import type { WorkbookCell, WorkbookCellValue, WorkbookErrorCode, WorkbookSheet } from "./engine-types.ts";
import type {
  WorkbookBasis,
  WorkbookBindingState,
  WorkbookLayout,
  WorkbookReviewRollup,
  WorkbookSheetKind,
  WorkbookSheetLayout,
} from "./types.ts";

export interface WorkbookAgentLimits {
  /** Take-offs whose workbooks one answer may describe. */
  readonly maxWorkbooks: number;
  /** Cells reported per workbook, most explanatory first. */
  readonly maxCellsPerWorkbook: number;
}

export const WORKBOOK_AGENT_LIMITS: WorkbookAgentLimits = Object.freeze({
  maxWorkbooks: 3,
  maxCellsPerWorkbook: 60,
});

export interface WorkbookCellNote {
  /** The worksheet as a person sees it named today. */
  readonly sheet: string;
  readonly sheetKind: WorkbookSheetKind;
  /** A1 notation, so an answer can name the cell the way the grid does. */
  readonly ref: string;
  /** The formula as stored. Null for a cell holding a typed value. */
  readonly formula: string | null;
  /** A value a PERSON typed. Never a calculated one — see the module note. */
  readonly enteredValue: WorkbookCellValue | null;
  /** The bill line or bill this row of the grid stands for. */
  readonly explains: string | null;
  readonly sourceRowId: string | null;
  readonly sourceState: WorkbookBindingState | null;
  readonly sourceBasis: WorkbookBasis | null;
  readonly sourceRevision: number | null;
  /** Structural only: the dependency is gone, so the cell cannot hold a figure. */
  readonly error: WorkbookErrorCode | null;
}

export interface WorkbookNote {
  readonly sessionId: string;
  readonly version: number;
  readonly engineVersion: string;
  readonly savedAt: string;
  readonly savedBy: string | null;
  /**
   * False when a measurement behind this workbook has moved since it was last
   * saved. It does NOT mean a formula is wrong — formulas recalculate on open —
   * it means nobody has saved the workbook against today's figures.
   */
  readonly dependenciesUnchangedSinceSave: boolean;
  readonly reviewBasis: WorkbookReviewRollup;
  readonly cells: readonly WorkbookCellNote[];
  readonly cellsPresent: number;
  readonly cellsTruncated: boolean;
}

export interface WorkbookAgentRead {
  readonly bySession: ReadonlyMap<string, WorkbookNote>;
  readonly workbooksPresent: number;
  readonly workbooksTruncated: boolean;
}

/** The generated column that holds a figure worth explaining, on the Summary only. */
const SUMMARY_TOTAL_FIELD = "amount";

/** What the hydrator writes into every generated column of a withdrawn slot. */
const REF_FORMULA = "=#REF!";

function isReportable(sheet: WorkbookSheetLayout, column: number): boolean {
  if (sheet.kind === "scratch") return true;
  if (column >= sheet.freeColumnStart) return true;
  // A bill sheet's generated columns restate the bill line, which the caller
  // already reports from the rows themselves, and restate it AS AT THE LAST
  // SAVE. Only the Summary's total formula earns its place here.
  return sheet.kind === "summary" && sheet.columns[String(column)] === SUMMARY_TOTAL_FIELD;
}

interface RowContext {
  readonly explains: string | null;
  readonly rowId: string | null;
  readonly state: WorkbookBindingState | null;
  readonly basis: WorkbookBasis | null;
  readonly revision: number | null;
}

const NO_CONTEXT: RowContext = Object.freeze({
  explains: null,
  rowId: null,
  state: null,
  basis: null,
  revision: null,
});

/**
 * The bill as it stands, against which the SAVED layout is re-judged.
 *
 * A layout is rebuilt on save and not before, so a line withdrawn since then is
 * still recorded there as `bound`. Believing it would have the assistant
 * explain a cell in terms of a measurement that no longer exists, which is the
 * single most misleading thing it could say about a workbook. Liveness is
 * therefore taken from the rows, never from the layout; `describe` still covers
 * withdrawn lines, because naming what a broken cell USED to stand for is the
 * whole of the explanation.
 */
export interface WorkbookSourceIndex {
  readonly describe: (rowId: string) => string | null;
  readonly isLiveRow: (rowId: string) => boolean;
  readonly isLiveBill: (billId: string) => boolean;
}

/**
 * The saved layout with every binding re-judged against the bill as it stands.
 *
 * Done ONCE, here, so that the cell notes and the shipped `reviewRollup` are
 * both reading the same corrected picture. Fixing the input rather than the
 * rollup matters: `reviewRollup` is the same function the live document uses,
 * where the layout it is handed was just rebuilt and is already right.
 */
function asOfNow(layout: WorkbookLayout, index: WorkbookSourceIndex): WorkbookLayout {
  const withdrawnRow = (binding: WorkbookSheetLayout["bindings"][number]): boolean =>
    binding.state === "withdrawn" || !index.isLiveRow(binding.rowId);

  return {
    ...layout,
    sheets: layout.sheets.map((sheet) => ({
      ...sheet,
      bindings: sheet.bindings.map((binding) =>
        withdrawnRow(binding)
          ? { ...binding, state: "withdrawn" as const, remeasurable: false }
          : binding,
      ),
      ...(sheet.billSlots === undefined
        ? {}
        : {
            billSlots: sheet.billSlots.map((slot) =>
              slot.state === "withdrawn" || !index.isLiveBill(slot.billId)
                ? { ...slot, state: "withdrawn" as const }
                : slot,
            ),
          }),
    })),
  };
}

function contextAt(
  sheet: WorkbookSheetLayout,
  gridRow: number,
  describe: (rowId: string) => string | null,
): RowContext {
  const slot = sheet.billSlots?.find((entry) => entry.gridRow === gridRow);
  if (slot) {
    return { explains: slot.label, rowId: null, state: slot.state, basis: null, revision: null };
  }
  const binding = sheet.bindings.find((entry) => entry.gridRow === gridRow);
  if (!binding) return NO_CONTEXT;
  return {
    explains: describe(binding.rowId),
    rowId: binding.rowId,
    state: binding.state,
    basis: binding.basis,
    revision: binding.revision,
  };
}

/** The generated column whose figure a person would look for on this worksheet. */
function headlineColumn(sheet: WorkbookSheetLayout): number {
  const wanted = sheet.kind === "summary" ? SUMMARY_TOTAL_FIELD : "qty";
  const match = Object.entries(sheet.columns).find(([, field]) => field === wanted);
  return Number(match?.[0] ?? 0);
}

function noteOf(
  cell: WorkbookCell,
  sheet: WorkbookSheetLayout,
  at: { readonly row: number; readonly column: number },
  context: RowContext,
): WorkbookCellNote {
  const withdrawn = cell.f === REF_FORMULA || context.state === "withdrawn";
  return {
    sheet: sheet.label,
    sheetKind: sheet.kind,
    ref: `${columnLetter(at.column)}${at.row + 1}`,
    formula: cell.f ?? null,
    enteredValue: cell.f === undefined ? (cell.v ?? null) : null,
    explains: context.explains,
    sourceRowId: context.rowId,
    sourceState: context.state,
    sourceBasis: context.basis,
    sourceRevision: context.revision,
    error: withdrawn ? "#REF!" : null,
  };
}

/** A formula explains more than a typed number, so it survives truncation first. */
const explanatoryFirst = (a: WorkbookCellNote, b: WorkbookCellNote): number =>
  Number(b.formula !== null) - Number(a.formula !== null);

/**
 * A slot whose bill line is gone, reported even though no user cell sits on it.
 *
 * Without this a withdrawal is INVISIBLE to the assistant: the generated
 * columns that would show `#REF!` are the ones deliberately left out, so the
 * only trace would be a scratch total that no longer adds up and no way to say
 * why. A broken dependency is the answer to that question, so it is reported as
 * what it is — a cell holding no figure — rather than as a separate concept.
 */
function withdrawnNotes(
  sheet: WorkbookSheetLayout,
  describe: (rowId: string) => string | null,
  covered: ReadonlySet<number>,
): WorkbookCellNote[] {
  const column = headlineColumn(sheet);
  return sheet.bindings
    .filter((binding) => binding.state === "withdrawn" && !covered.has(binding.gridRow))
    .map((binding) =>
      noteOf({}, sheet, { row: binding.gridRow, column }, contextAt(sheet, binding.gridRow, describe)),
    );
}

function cellsOf(
  layout: readonly WorkbookSheetLayout[],
  sheets: Readonly<Record<string, WorkbookSheet>>,
  describe: (rowId: string) => string | null,
): WorkbookCellNote[] {
  const notes: WorkbookCellNote[] = [];
  for (const sheet of layout) {
    const stored = sheets[sheet.sheetId];
    if (stored === undefined) continue;
    const covered = new Set<number>();
    for (const [rowKey, line] of Object.entries(stored.cellData)) {
      const row = Number(rowKey);
      const context = contextAt(sheet, row, describe);
      for (const [columnKey, cell] of Object.entries(line)) {
        const column = Number(columnKey);
        if (!isReportable(sheet, column)) continue;
        if (cell.f === undefined && (cell.v ?? null) === null) continue;
        covered.add(row);
        notes.push(noteOf(cell, sheet, { row, column }, context));
      }
    }
    notes.push(...withdrawnNotes(sheet, describe, covered));
  }
  return notes;
}

/**
 * One SQL-only look at each take-off's saved workbook.
 *
 * `sessionIds` must already be scoped to a project by its caller's query — this
 * function trusts them and reads them directly, so handing it an id that came
 * from a model rather than from a project-scoped read would reach another
 * organisation's take-off.
 */
export async function workbookNotesForSessions(
  db: Knex,
  sessionIds: readonly string[],
  limits: WorkbookAgentLimits = WORKBOOK_AGENT_LIMITS,
): Promise<WorkbookAgentRead> {
  const wanted = sessionIds.slice(0, limits.maxWorkbooks);
  const bySession = new Map<string, WorkbookNote>();

  const states = await Promise.all(wanted.map((sessionId) => readCoherentState(db, sessionId)));

  for (const [index, { source, stored }] of states.entries()) {
    const sessionId = wanted[index]!;
    if (stored === undefined) continue;

    const rows = liveRowsById(source);
    // Tombstones included: naming what a broken cell used to stand for is the
    // explanation a person is after.
    const described = new Map(source.rows.map((row) => [row.id, row.description]));
    const liveBills = new Set(source.bills.map((bill) => bill.id));
    const unchanged = stored.source_fingerprint === sourceFingerprint(source);
    const layout = asOfNow(stored.layout, {
      describe: (rowId) => described.get(rowId) ?? null,
      isLiveRow: (rowId) => rows.has(rowId),
      isLiveBill: (billId) => liveBills.has(billId),
    });
    const all = cellsOf(layout.sheets, stored.snapshot.sheets, (rowId) => described.get(rowId) ?? null).sort(
      explanatoryFirst,
    );

    bySession.set(sessionId, {
      sessionId,
      version: stored.version,
      engineVersion: stored.engine_version,
      savedAt: new Date(stored.updated_at).toISOString(),
      savedBy: stored.updated_by,
      dependenciesUnchangedSinceSave: unchanged,
      reviewBasis: reviewRollup(layout, rows, !unchanged),
      cells: all.slice(0, limits.maxCellsPerWorkbook),
      cellsPresent: all.length,
      cellsTruncated: all.length > limits.maxCellsPerWorkbook,
    });
  }

  return {
    bySession,
    workbooksPresent: sessionIds.length,
    workbooksTruncated: sessionIds.length > limits.maxWorkbooks,
  };
}
