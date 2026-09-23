// Data access for the take-off editor: locking, version checks, soft delete,
// operation idempotency and operation bounds. No business maths lives here —
// nothing in this file decides what a line is worth, only which rows an
// operation is allowed to touch and whether it still owns them.
//
// Every method runs inside a transaction the caller already owns (see
// editor-unit-of-work.ts). There is deliberately no `db` reference: a lock
// taken outside the caller's transaction would be released the moment the
// statement returned, which is worse than no lock at all.

import type { Knex } from "knex";
import { ConflictError, NotFoundError, PayloadTooLargeError } from "../../../lib/errors.ts";
import type { DrawingMarkupRow } from "../../drawing-markup/types.ts";
import type { Deduction, PreconGeometryRow } from "./geometry-types.ts";
import type { PreconAuditEventRow, PreconBoqRowRow, RowStatus } from "./row-types.ts";
import type { PreconSheetRow } from "./session-types.ts";

/** Exactly the editable columns a reversal writes back; nothing derived. */
interface RowRestorePatch {
  description: string;
  unit: string | null;
  qty_gross: number | null;
  qty: number | null;
  deductions: Deduction[];
  typical: number;
  rate: number | null;
  amount: number | null;
  measurement_basis: string | null;
  measurement_settings: unknown;
  status: RowStatus | null;
  deleted_at: Date | null;
  edited_by: string;
}

export type EditorRepository = ReturnType<typeof editorRepository>;

export interface OperationScope {
  rowIds: string[];
  geometryIds: string[];
  sheetIds: string[];
  markupIds: string[];
}

/**
 * How much one editor operation may touch. A single save is a person's edit,
 * not a bulk job: past these bounds the request is a mistake or an attack, and
 * running it would hold the session lock long enough to stall every other
 * editor on the drawing.
 */
export const OPERATION_LIMITS = {
  geometries: 200,
  rows: 1000,
  sheets: 50,
  markups: 50,
} as const;

/** Postgres `lock_not_available` — what `FOR UPDATE NOWAIT` raises when it would block. */
const LOCK_NOT_AVAILABLE = "55P03";

export function isLockNotAvailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ((error as { code?: unknown }).code === LOCK_NOT_AVAILABLE) return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && /could not obtain lock/i.test(message);
}

/**
 * Refuse an operation whose scope is out of proportion, naming the bound it
 * hit so the client can say which selection was too big.
 */
export function assertOperationLimits(scope: OperationScope): void {
  const checks: [number, number, string][] = [
    [scope.geometryIds.length, OPERATION_LIMITS.geometries, "geometries"],
    [scope.rowIds.length, OPERATION_LIMITS.rows, "rows"],
    [scope.sheetIds.length, OPERATION_LIMITS.sheets, "sheets"],
    [scope.markupIds.length, OPERATION_LIMITS.markups, "markups"],
  ];
  for (const [count, max, what] of checks) {
    if (count > max) throw new PayloadTooLargeError(`Operation exceeds limit: too many ${what} (max ${max})`);
  }
}

function conflictOnLock(error: unknown, what: string): never {
  if (isLockNotAvailable(error)) {
    throw new ConflictError(`${what} is being edited by someone else; refresh and reapply`);
  }
  throw error;
}

function assertVersion(what: string, current: number, expected: number): void {
  if (current === expected) return;
  throw new ConflictError(`${what} was updated by someone else (current version ${current}); refresh and reapply`);
}

export function editorRepository(trx: Knex.Transaction) {
  const now = () => trx.fn.now();
  const bumped = () => trx.raw("version + 1") as never;

  async function lockedRow(rowId: string): Promise<PreconBoqRowRow | undefined> {
    try {
      return await trx<PreconBoqRowRow>("precon_boq_rows").where({ id: rowId }).forUpdate().noWait().first();
    } catch (error) {
      return conflictOnLock(error, "Row");
    }
  }

  return {
    async lockRow(rowId: string, expectedVersion: number): Promise<PreconBoqRowRow> {
      const row = await lockedRow(rowId);
      if (!row) throw new NotFoundError("BOQ row");
      assertVersion("Row", row.version, expectedVersion);
      return row;
    },

    async lockSheet(sheetId: string, expectedVersion: number): Promise<PreconSheetRow> {
      let sheet: PreconSheetRow | undefined;
      try {
        sheet = await trx<PreconSheetRow>("precon_sheets").where({ id: sheetId }).forUpdate().noWait().first();
      } catch (error) {
        return conflictOnLock(error, "Sheet");
      }
      if (!sheet) throw new NotFoundError("Sheet");
      assertVersion("Sheet", sheet.version ?? 1, expectedVersion);
      return sheet;
    },

    async lockMarkup(markupId: string, expectedVersion: number): Promise<DrawingMarkupRow> {
      let markup: DrawingMarkupRow | undefined;
      try {
        markup = await trx<DrawingMarkupRow>("drawing_markups").where({ id: markupId }).forUpdate().noWait().first();
      } catch (error) {
        return conflictOnLock(error, "Markup");
      }
      if (!markup) throw new NotFoundError("Markup");
      assertVersion("Markup", markup.version ?? 1, expectedVersion);
      return markup;
    },

    // Withdrawing a line hides it and moves its version on, so an editor
    // holding the old version cannot resurrect it with a stale save.
    async softDeleteRow(rowId: string, deletedAt: Date): Promise<PreconBoqRowRow> {
      const rows = await trx<PreconBoqRowRow>("precon_boq_rows")
        .where({ id: rowId })
        .update({ deleted_at: deletedAt, version: bumped(), updated_at: now() }, "*");
      const updated = (rows as PreconBoqRowRow[])[0];
      if (!updated) throw new NotFoundError("BOQ row");
      return updated;
    },

    async softRestoreRow(rowId: string): Promise<PreconBoqRowRow> {
      const rows = await trx<PreconBoqRowRow>("precon_boq_rows")
        .where({ id: rowId })
        .update({ deleted_at: null, version: bumped(), updated_at: now() }, "*");
      const updated = (rows as PreconBoqRowRow[])[0];
      if (!updated) throw new NotFoundError("BOQ row");
      return updated;
    },

    async softDeleteGeometry(geometryId: string, deletedAt: Date): Promise<PreconGeometryRow> {
      const rows = await trx<PreconGeometryRow>("precon_geometries")
        .where({ id: geometryId })
        .update({ deleted_at: deletedAt }, "*");
      const updated = (rows as PreconGeometryRow[])[0];
      if (!updated) throw new NotFoundError("Geometry");
      return updated;
    },

    async softRestoreGeometry(geometryId: string): Promise<PreconGeometryRow> {
      const rows = await trx<PreconGeometryRow>("precon_geometries")
        .where({ id: geometryId })
        .update({ deleted_at: null }, "*");
      const updated = (rows as PreconGeometryRow[])[0];
      if (!updated) throw new NotFoundError("Geometry");
      return updated;
    },

    // The unique partial index (session_id, actor, operation_id) is what makes
    // a retry idempotent: if the first attempt committed, its receipt is here.
    async findCommittedOperation(
      sessionId: string,
      actor: string,
      operationId: string,
    ): Promise<PreconAuditEventRow | null> {
      const event = await trx<PreconAuditEventRow>("precon_audit_events")
        .where({ session_id: sessionId, actor, operation_id: operationId })
        .whereNotNull("operation_id")
        .first();
      return event ?? null;
    },

    async insertOperationAudit(event: Omit<PreconAuditEventRow, "created_at">): Promise<PreconAuditEventRow> {
      const [inserted] = await trx<PreconAuditEventRow>("precon_audit_events")
        .insert({
          ...event,
          before: (event.before === null ? null : JSON.stringify(event.before)) as never,
          after: (event.after === null ? null : JSON.stringify(event.after)) as never,
        })
        .returning("*");
      return inserted as PreconAuditEventRow;
    },

    /**
     * Putting a bill line back the way an operation recorded it. The version
     * moves FORWARD, never back: restoring an old version number would hand two
     * different contents the same version, and every optimistic check downstream
     * would then accept a stale save. `verified_by`/`verified_at` are cleared
     * rather than restored — a reversal is a new act, and it does not re-sign a
     * figure on behalf of whoever signed the old one.
     */
    async restoreRowState(rowId: string, state: RowRestorePatch): Promise<PreconBoqRowRow> {
      const rows = await trx<PreconBoqRowRow>("precon_boq_rows")
        .where({ id: rowId })
        .update(
          {
            description: state.description,
            unit: state.unit,
            qty_gross: state.qty_gross,
            qty: state.qty,
            deductions: JSON.stringify(state.deductions) as never,
            typical: state.typical,
            rate: state.rate,
            amount: state.amount,
            measurement_basis: state.measurement_basis,
            measurement_settings: (state.measurement_settings === null || state.measurement_settings === undefined
              ? null
              : JSON.stringify(state.measurement_settings)) as never,
            status: state.status,
            deleted_at: state.deleted_at,
            verified_by: null,
            verified_at: null,
            edited_at: new Date(),
            edited_by: state.edited_by,
            version: bumped(),
            updated_at: now(),
          },
          "*",
        );
      const updated = (rows as PreconBoqRowRow[])[0];
      if (!updated) throw new NotFoundError("BOQ row");
      return updated;
    },

    async bumpRowVersion(rowId: string): Promise<PreconBoqRowRow> {
      const editedAt = new Date();
      const rows = await trx<PreconBoqRowRow>("precon_boq_rows")
        .where({ id: rowId })
        .update({ edited_at: editedAt, version: bumped(), updated_at: now() }, "*");
      const updated = (rows as PreconBoqRowRow[])[0];
      if (!updated) throw new NotFoundError("BOQ row");
      return updated;
    },

    async bumpSheetVersion(sheetId: string): Promise<PreconSheetRow> {
      const rows = await trx<PreconSheetRow>("precon_sheets")
        .where({ id: sheetId })
        .update({ version: bumped(), updated_at: now() }, "*");
      const updated = (rows as PreconSheetRow[])[0];
      if (!updated) throw new NotFoundError("Sheet");
      return updated;
    },

    // Rows whose quantity is a formula over measured anchors. Correcting an
    // anchor restates these, so the caller needs the set before it commits —
    // the evaluation itself stays in the engine, not here.
    derivedRowsForSession(sessionId: string): Promise<PreconBoqRowRow[]> {
      return trx<PreconBoqRowRow>("precon_boq_rows")
        .whereIn("bill_id", trx("precon_bills").select("id").where({ session_id: sessionId }))
        .whereNull("deleted_at")
        .whereNot({ status: "rejected" })
        .whereLike("measurement_basis", "Derived:%")
        .orderBy("sort", "asc");
    },

    // The organisation the session belongs to. An assembly is an org-scoped rate
    // card, so the measure has to be told which org's card to price against —
    // read here rather than trusted from the request.
    async sessionOrgId(sessionId: string): Promise<string> {
      const row = await trx<{ id: string; org_id: string }>("precon_sessions")
        .where({ id: sessionId })
        .select("org_id")
        .first();
      if (!row) throw new NotFoundError("Preconstruction session");
      return row.org_id;
    },

    async checkOperationLimits(scope: OperationScope): Promise<void> {
      assertOperationLimits(scope);
    },
  };
}
