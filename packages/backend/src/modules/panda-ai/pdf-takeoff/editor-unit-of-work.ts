// One editor operation = one transaction, one session lock, one flush.
//
// A take-off edit is never a single write: moving a wall restates its bill
// line, its deductions, the derived lines built off it and the audit trail. If
// those land as separate statements, a crash between them leaves a bill nobody
// can defend — a quantity with no measurement, or an audit entry for an edit
// that did not happen. So the whole operation commits or none of it does.
//
// The session row is locked NOWAIT rather than waited on: two people saving the
// same drawing at once should be told immediately, not held on a lock while the
// first save runs and then applied on top of a state they never saw.
//
// Realtime events are collected, not published, until the transaction commits.
// Publishing inside the transaction would tell every other editor about a
// change that can still roll back.

import type { Knex } from "knex";
import { preconAuditRepository } from "./audit-repository.ts";
import { lockSession, type SessionLockMode } from "./session-lock.ts";
import { editorRepository, type EditorRepository } from "./editor-repository.ts";
import { preconGeometryRepository } from "./geometry-repository.ts";
import { preconRowRepository } from "./row-repository.ts";
import { preconSessionRepository } from "./session-repository.ts";
import { preconSheetRepository } from "./sheet-repository.ts";
import type { OverlaySettingsV1 } from "./editor-overlay.ts";
import type { PreconChangeEvent, PublishFn } from "./service.ts";
import type {
  PreconAuditEventRow,
  PreconBillRow,
  PreconBoqRowRow,
  PreconGeometryRow,
  PreconSessionRow,
  PreconSheetRow,
  SheetCalibrationPatch,
  SheetViewport,
} from "./types.ts";

/** Repositories narrowed to the caller's transaction — never the pool. */
export type BoundRowRepository = ReturnType<typeof preconRowRepository>;
export type BoundGeometryRepository = ReturnType<typeof preconGeometryRepository>;
export type BoundSheetRepository = ReturnType<typeof preconSheetRepository>;
export type BoundAuditRepository = ReturnType<typeof preconAuditRepository>;
/** Bills live with the session queries; an editor write only ever needs these three. */
export interface BoundBillRepository {
  billById(id: string): PromiseLike<PreconBillRow | undefined>;
  billsBySession(sessionId: string): PromiseLike<PreconBillRow[]>;
  insertBill(row: Omit<PreconBillRow, "created_at">): PromiseLike<PreconBillRow>;
}

type RowPatch = Parameters<BoundRowRepository["updateRowVersioned"]>[2];
type GeometryInsert = Parameters<BoundGeometryRepository["insertGeometries"]>[0][number];
type GeometryPatch = Parameters<BoundGeometryRepository["updateGeometryMeasurement"]>[1];

export interface UoWContext {
  trx: Knex.Transaction;
  rows: BoundRowRepository;
  geometries: BoundGeometryRepository;
  sheets: BoundSheetRepository;
  audits: BoundAuditRepository;
  /** Queue an event for publication after commit, never before. */
  emit(event: PreconChangeEvent): void;
}

/**
 * The slice of the unit of work the editor's writers actually touch, plus the
 * bill lookup a new line needs. Narrow on purpose: it is the seam a unit test
 * can stand up in full without a database, so "every write is inside the lock"
 * is provable in-process rather than only against Postgres.
 */
export interface EditorWriteContext {
  rows: {
    rowById(id: string): PromiseLike<PreconBoqRowRow | undefined>;
    rowsBySession(sessionId: string): PromiseLike<PreconBoqRowRow[]>;
    nextRowSort(billId: string): PromiseLike<number>;
    insertBoqRow(row: Omit<PreconBoqRowRow, "created_at" | "updated_at">): PromiseLike<PreconBoqRowRow>;
    updateRowVersioned(id: string, version: number, patch: RowPatch): PromiseLike<PreconBoqRowRow | null>;
    applyDerivedRecompute(
      id: string,
      qty: number,
      amount: number | null,
      measurementBasis: string,
    ): PromiseLike<PreconBoqRowRow | null>;
  };
  geometries: {
    measurementGeometryForRow(rowId: string): PromiseLike<PreconGeometryRow | undefined>;
    geometriesByRow(rowId: string): PromiseLike<PreconGeometryRow[]>;
    geometryById(id: string): PromiseLike<PreconGeometryRow | undefined>;
    insertGeometries(rows: GeometryInsert[]): PromiseLike<unknown>;
    replaceRowGeometry(rowId: string, geometry: GeometryInsert): PromiseLike<unknown>;
    softDeleteGeometry(id: string, deletedAt: Date): PromiseLike<unknown>;
    updateGeometryMeasurement(id: string, patch: GeometryPatch): PromiseLike<unknown>;
  };
  sheets: {
    sheetById(id: string): PromiseLike<PreconSheetRow | undefined>;
  };
  audits: {
    insertAuditEvent(row: Omit<PreconAuditEventRow, "created_at">): PromiseLike<unknown>;
  };
  bills: BoundBillRepository;
  emit(event: PreconChangeEvent): void;
}

/**
 * The reads a calibration preview needs, and nothing that writes. Re-scaling a
 * sheet is shown before it is committed, and the showing must be incapable of
 * changing anything — so the preview is handed this, never a write context.
 */
export interface CalibrationReadContext {
  sheets: { sheetById(id: string): PromiseLike<PreconSheetRow | undefined> };
  geometries: {
    geometriesBySheet(sheetId: string): PromiseLike<PreconGeometryRow[]>;
    // A line is re-added from ALL of its shapes, including ones on other
    // drawings, so the per-sheet read is not enough to say what it becomes.
    geometriesByRow(rowId: string): PromiseLike<PreconGeometryRow[]>;
  };
  rows: { rowsByIds(ids: string[]): PromiseLike<PreconBoqRowRow[]> };
}

/**
 * The editor context widened for the two sheet-level operations. Both restate
 * every line measured on one drawing, so they need the sheet-wide reads the
 * per-row writers never do, plus the version-checked sheet writes.
 */
export interface CalibrationWriteContext extends EditorWriteContext {
  rows: EditorWriteContext["rows"] & CalibrationReadContext["rows"];
  geometries: EditorWriteContext["geometries"] & CalibrationReadContext["geometries"];
  sheets: EditorWriteContext["sheets"] & {
    lockSheet(sheetId: string, expectedVersion: number): PromiseLike<PreconSheetRow>;
    applyCalibration(id: string, patch: SheetCalibrationPatch): PromiseLike<PreconSheetRow>;
    replaceViewports(id: string, viewports: SheetViewport[]): PromiseLike<PreconSheetRow>;
  };
}

/**
 * The editor context widened for the edits that restate several lines at once
 * — a split, a merge, a reassignment. They read their rows and annotations in
 * batches rather than one query per line, and a merge withdraws the lines it
 * absorbs, so they need the soft deletes the per-row writers never do.
 */
export interface BatchWriteContext extends EditorWriteContext {
  rows: EditorWriteContext["rows"] & {
    rowsByIds(ids: string[]): PromiseLike<PreconBoqRowRow[]>;
    softDeleteRow(id: string, deletedAt: Date): PromiseLike<PreconBoqRowRow | null>;
  };
  geometries: EditorWriteContext["geometries"] & {
    geometriesByRows(rowIds: string[]): PromiseLike<PreconGeometryRow[]>;
    moveGeometryToRow(id: string, rowId: string): PromiseLike<unknown>;
    reparentGeometry(id: string, parentGeometryId: string): PromiseLike<unknown>;
    softDeleteGeometriesForRow(rowId: string, deletedAt: Date): PromiseLike<unknown>;
  };
}

/**
 * The editor context widened for the operation envelope. It adds exactly what a
 * receipt and its reversal need beyond an ordinary edit: the tombstone-visible
 * reads (an undo restores records the active readers cannot see), the writes that
 * put a recorded state back, and the audit lookups that decide whether a save is
 * a retry of one already committed.
 */
export interface OperationWriteContext extends EditorWriteContext {
  /**
   * The transaction this operation owns. Cross-domain composers (the assembly
   * measure, which needs a whole `preconRepository` and the rate library) build
   * their own repositories from it, so their writes land inside this lock rather
   * than on the pool beside it.
   */
  trx: Knex.Transaction;
  geometries: EditorWriteContext["geometries"] & {
    geometryByIdIncludeDeleted(id: string): PromiseLike<PreconGeometryRow | undefined>;
    geometriesBySheet(sheetId: string): PromiseLike<PreconGeometryRow[]>;
    geometriesByRows(rowIds: string[]): PromiseLike<PreconGeometryRow[]>;
    moveGeometryToRow(id: string, rowId: string): PromiseLike<unknown>;
    reparentGeometry(id: string, parentGeometryId: string): PromiseLike<unknown>;
    softDeleteGeometriesForRow(rowId: string, deletedAt: Date): PromiseLike<unknown>;
    restoreGeometryState: BoundGeometryRepository["restoreGeometryState"];
  };
  rows: EditorWriteContext["rows"] & {
    rowByIdIncludeDeleted(id: string): PromiseLike<PreconBoqRowRow | undefined>;
    softDeleteRow(id: string, deletedAt: Date): PromiseLike<PreconBoqRowRow | null>;
    rowsByIds(ids: string[]): PromiseLike<PreconBoqRowRow[]>;
    // The take-off a line belongs to, through its bill. Every id in an operation
    // is caller-supplied, so membership is asked of the line itself.
    sessionIdForRow(rowId: string): PromiseLike<string | null>;
  };
  sheets: EditorWriteContext["sheets"] & {
    lockSheet(sheetId: string, expectedVersion: number): PromiseLike<PreconSheetRow>;
    applyCalibration(id: string, patch: SheetCalibrationPatch): PromiseLike<PreconSheetRow>;
    replaceViewports(id: string, viewports: SheetViewport[]): PromiseLike<PreconSheetRow>;
    setOverlaySettings(id: string, overlay: OverlaySettingsV1 | null): PromiseLike<PreconSheetRow>;
  };
  // The take-off a drawing belongs to. Only reads: an overlay has to prove the
  // two drawings are revisions of the same plan before it records an alignment.
  sessions: { sessionById(id: string): PromiseLike<PreconSessionRow | undefined> };
  editor: EditorRepository;
}

export type WithOperationWrite = <T>(
  sessionId: string,
  callback: (ctx: OperationWriteContext) => Promise<T>,
) => Promise<T>;

export type WithSessionWrite = <T>(sessionId: string, callback: (ctx: UoWContext) => Promise<T>) => Promise<T>;

/**
 * The sole transaction owner for editor writes. The callback must not open a
 * nested transaction: a nested `db.transaction()` runs on its own connection,
 * outside this one's lock and rollback, which is exactly the split-write this
 * seam exists to prevent.
 */
export function createEditorUnitOfWork(db: Knex, publish?: PublishFn, mode: SessionLockMode = "nowait") {
  const withSessionWrite: WithSessionWrite = async (sessionId, callback) => {
    const collected: PreconChangeEvent[] = [];
    const result = await db.transaction(async (trx) => {
      await lockSession(trx, sessionId, mode);
      return callback({
        trx,
        rows: preconRowRepository(trx),
        geometries: preconGeometryRepository(trx),
        sheets: preconSheetRepository(trx),
        audits: preconAuditRepository(trx),
        emit: (event) => {
          collected.push(event);
        },
      });
    });
    if (publish) for (const event of collected) publish(event.sessionId, event);
    return result;
  };
  return withSessionWrite;
}

/**
 * The unit of work the operation envelope runs in: a WAITING session lock, so a
 * retry of a save that is still in flight queues behind it and is then answered
 * from its committed receipt instead of being refused.
 */
export function createOperationUnitOfWork(db: Knex, publish?: PublishFn) {
  const withSessionWrite = createEditorUnitOfWork(db, publish, "wait");
  const withOperationWrite: WithOperationWrite = (sessionId, callback) =>
    withSessionWrite(sessionId, (ctx) =>
      callback({
        ...ctx,
        bills: preconSessionRepository(ctx.trx),
        sessions: preconSessionRepository(ctx.trx),
        // the sheet lock is the editor repository's, because only a lock taken
        // inside this transaction outlives the statement that took it
        sheets: { ...ctx.sheets, lockSheet: editorRepository(ctx.trx).lockSheet },
        editor: editorRepository(ctx.trx),
      }),
    );
  return withOperationWrite;
}
