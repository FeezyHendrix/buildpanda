// One coherent look at everything a workbook depends on.
//
// Read inside a single READ ONLY transaction and never piecemeal, because the
// alternative is a document whose Summary was calculated against nine bills and
// whose bill sheet was calculated against ten. That is not a stale figure, it
// is an incoherent one, and no version check downstream can detect it.
//
// The transaction takes no lock and writes nothing: contract 6 puts the
// expensive calculation strictly between this read and the lock, so a worker
// never runs while a row is held.

import type { Knex } from "knex";
import { NotFoundError } from "../../../../lib/errors.ts";
import { preconWorkbookRepository } from "./repository.ts";
import type { PreconWorkbookRow } from "./types.ts";
import type { PreconBillRow, PreconBoqRowRow, PreconGeometryRow, PreconSheetRow } from "../types.ts";

/**
 * The sources as they stood at one instant. `rows` keeps tombstones: a
 * withdrawn line still owns its worksheet slot, and dropping it here would
 * slide every line beneath it up by one and silently repoint user formulas.
 */
export interface WorkbookSourceSet {
  readonly sessionId: string;
  readonly revision: number;
  readonly bills: readonly PreconBillRow[];
  readonly rows: readonly PreconBoqRowRow[];
  readonly geometries: readonly PreconGeometryRow[];
  readonly sheets: readonly PreconSheetRow[];
}

export interface WorkbookReadState {
  readonly source: WorkbookSourceSet;
  readonly stored: PreconWorkbookRow | undefined;
}

async function readWithin(trx: Knex.Transaction, sessionId: string): Promise<WorkbookReadState> {
  const repo = preconWorkbookRepository(trx);
  const session = await repo.sessionById(sessionId);
  if (!session) throw new NotFoundError("Preconstruction session");

  const [stored, bills, rows, geometries, sheets] = await Promise.all([
    repo.workbookBySession(sessionId),
    repo.billsBySession(sessionId),
    repo.sourceRowsIncludingWithdrawn(sessionId),
    repo.activeGeometriesBySession(sessionId),
    repo.sheetsBySession(sessionId),
  ]);

  return {
    stored,
    source: { sessionId, revision: session.revision ?? 1, bills, rows, geometries, sheets },
  };
}

/** The coherent read, as a caller outside any lock performs it. */
export function readCoherentState(db: Knex, sessionId: string): Promise<WorkbookReadState> {
  return db.transaction((trx) => readWithin(trx, sessionId), { readOnly: true });
}

/**
 * The same read re-run inside the session lock, to prove nothing moved while
 * the calculation was running. It joins the caller's transaction rather than
 * opening its own — a nested `db.transaction()` would run on another connection
 * and see a different snapshot, which is the exact incoherence being checked for.
 */
export function reReadUnderLock(trx: Knex.Transaction, sessionId: string): Promise<WorkbookReadState> {
  return readWithin(trx, sessionId);
}

/** Live annotations that stand as evidence for a figure. Openings are not evidence. */
export function measuringGeometriesByRow(source: WorkbookSourceSet): Map<string, PreconGeometryRow[]> {
  const byRow = new Map<string, PreconGeometryRow[]>();
  for (const geometry of source.geometries) {
    if (geometry.kind === "deduction") continue;
    const existing = byRow.get(geometry.row_id);
    if (existing) existing.push(geometry);
    else byRow.set(geometry.row_id, [geometry]);
  }
  return byRow;
}
