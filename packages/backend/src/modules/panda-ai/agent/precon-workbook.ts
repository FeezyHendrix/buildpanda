// The take-off workbook as Panda AI reads it.
//
// A PM's question about a workbook is almost never "what number is in B4" —
// the number is on their screen. It is "why does B4 say that", and the answer
// is the formula, the bill lines it reaches, and whether those lines have been
// verified. All three are persisted text, so all three can be answered from
// storage without calculating anything.
//
// What is deliberately absent is a calculated figure. The workbook module
// explains why at length (`workbook/agent-read.ts`); the short version is that
// the only numbers in storage are from the last save, and a stale figure quoted
// as current in a bid conversation is worse than no answer. Live quantities and
// amounts already reach the model through the bill lines beside this.
//
// This module is the seam between the two: it owns the PROJECT SCOPING and the
// shape the tool returns, and nothing about what a cell means.

import { workbookNotesForSessions, WORKBOOK_AGENT_LIMITS } from "../pdf-takeoff/workbook/agent-read.ts";
import type { Knex } from "knex";
import type { WorkbookCellNote } from "../pdf-takeoff/workbook/agent-read.ts";
import type { WorkbookReviewRollup } from "../pdf-takeoff/workbook/types.ts";
import type { PreconWorkbookSessionRow } from "./takeoff-repository.ts";

/** The read `get_precon_boq` needs, so the mapper can be driven without a tool. */
export interface PreconWorkbookReader {
  preconWorkbookSessions(projectId: string, limit: number): Promise<PreconWorkbookSessionRow[]>;
}

/**
 * Two values, and the model must never blur them. `current` says every
 * measurement this workbook depends on is still what it was when the workbook
 * was saved. `measurements_moved_since_last_save` says one has changed — the
 * formulas are still right, nobody has saved against the new figures yet.
 */
export const WORKBOOK_FIGURE_STATES = ["current", "measurements_moved_since_last_save"] as const;
export type WorkbookFigureState = (typeof WORKBOOK_FIGURE_STATES)[number];

export interface PreconWorkbookNote {
  readonly sessionId: string;
  readonly sessionTitle: string | null;
  readonly sourceRevision: number | null;
  readonly supersededByNewerRevision: boolean;
  readonly workbookVersion: number;
  readonly engineVersion: string;
  readonly savedAt: string;
  readonly savedBy: string | null;
  readonly figureState: WorkbookFigureState;
  readonly reviewBasis: WorkbookReviewRollup;
  readonly cells: readonly WorkbookCellNote[];
  readonly cellsReported: number;
  readonly cellsPresent: number;
  readonly cellsTruncated: boolean;
}

export interface PreconWorkbookSummary {
  readonly workbooks: readonly PreconWorkbookNote[];
  readonly workbooksReported: number;
  /**
   * True when the project has more workbooks than this answer covers. There is
   * no total beside it on purpose: the query asks for one more than it reports,
   * so "there are more" is known and "how many more" is not.
   */
  readonly workbooksTruncated: boolean;
  readonly limits: {
    readonly maxWorkbooks: number;
    readonly maxCellsPerWorkbook: number;
  };
}

export const PRECON_WORKBOOK_DESCRIPTION =
  "workbooks: the estimating workbook saved against each take-off — the spreadsheet a QS builds on top of the measured bill. " +
  "Per cell: sheet and ref (the worksheet and A1 address a person sees), formula (the stored formula text, exactly as written), " +
  "enteredValue (a value a PERSON typed; null whenever the cell holds a formula), " +
  "explains / sourceRowId / sourceState / sourceBasis / sourceRevision (which bill line or bill that row of the grid stands for, and against which revision), " +
  "and error (#REF! when the bill line behind the cell has been withdrawn, so the cell holds no figure at all — never report that as 0). " +
  "NO CALCULATED RESULT IS GIVEN HERE, on purpose: the only figures in storage are from the last save. " +
  "Explain a cell from its formula and the bill lines it reaches, and take live quantities, rates and amounts from the lines above, never from a workbook cell. " +
  "figureState is 'current' when every measurement behind the workbook is unchanged since it was saved, and 'measurements_moved_since_last_save' when one has moved — " +
  "say so plainly rather than implying the saved workbook has been re-checked. " +
  "reviewBasis counts how many of the bill lines it depends on are verified, need review, are unreviewed, have been withdrawn or were never drawn. " +
  "A total worked out on a scratch worksheet is a QS's working, NOT an estimate: it is only an estimate once someone explicitly applies the canonical BOQ to one, " +
  "so never present a scratch total as the project's figure and never offer to apply it. " +
  "workbooksTruncated / cellsTruncated true means there is more than this answer covers; say so rather than implying you saw everything.";

export async function preconWorkbookNotes(
  reader: PreconWorkbookReader,
  db: Knex,
  projectId: string,
): Promise<PreconWorkbookSummary> {
  // One more than we will report, so "there are more" comes from the database.
  const sessions = await reader.preconWorkbookSessions(projectId, WORKBOOK_AGENT_LIMITS.maxWorkbooks + 1);
  const read = await workbookNotesForSessions(
    db,
    sessions.slice(0, WORKBOOK_AGENT_LIMITS.maxWorkbooks).map((session) => session.session_id),
  );

  const workbooks: PreconWorkbookNote[] = [];
  for (const session of sessions) {
    const note = read.bySession.get(session.session_id);
    if (note === undefined) continue;
    workbooks.push({
      sessionId: session.session_id,
      sessionTitle: session.session_title,
      sourceRevision: session.session_revision,
      supersededByNewerRevision: session.session_superseded_by !== null,
      workbookVersion: note.version,
      engineVersion: note.engineVersion,
      savedAt: note.savedAt,
      savedBy: note.savedBy,
      figureState: note.dependenciesUnchangedSinceSave ? "current" : "measurements_moved_since_last_save",
      reviewBasis: note.reviewBasis,
      cells: note.cells,
      cellsReported: note.cells.length,
      cellsPresent: note.cellsPresent,
      cellsTruncated: note.cellsTruncated,
    });
  }

  return {
    workbooks,
    workbooksReported: workbooks.length,
    workbooksTruncated: sessions.length > WORKBOOK_AGENT_LIMITS.maxWorkbooks,
    limits: {
      maxWorkbooks: WORKBOOK_AGENT_LIMITS.maxWorkbooks,
      maxCellsPerWorkbook: WORKBOOK_AGENT_LIMITS.maxCellsPerWorkbook,
    },
  };
}
