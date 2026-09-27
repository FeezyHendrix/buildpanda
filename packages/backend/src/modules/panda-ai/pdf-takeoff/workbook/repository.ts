// Every SQL statement the workbook needs, and nothing else.
//
// No Fastify, no validation, no policy, no decisions about who may read what —
// those live in the service, which is why this file can be pointed at a
// transaction or at the pool without changing meaning. Callers that must write
// inside the session lock pass the transaction; callers doing the coherent read
// pass the pool.
//
// Two reads here deliberately differ from the shared row repository:
// `sourceRowsIncludingWithdrawn` keeps tombstones, because a withdrawn line
// still owns its worksheet slot and must render as a `#REF!` rather than
// vanishing and sliding every line below it up by one.

import type { Knex } from "knex";
import { WORKBOOK_ACTIONS } from "./types.ts";
import type { PreconWorkbookRow } from "./types.ts";
import type {
  PreconAuditEventRow,
  PreconBillRow,
  PreconBoqRowRow,
  PreconGeometryRow,
  PreconSessionRow,
  PreconSheetRow,
} from "../types.ts";

export type PreconWorkbookRepository = ReturnType<typeof preconWorkbookRepository>;

/** A workbook insert before the database fills in its timestamps. */
export type WorkbookInsert = Omit<PreconWorkbookRow, "created_at" | "updated_at">;

export function preconWorkbookRepository(db: Knex) {
  const json = (value: unknown): never => JSON.stringify(value) as never;

  return {
    workbookBySession: (sessionId: string) =>
      db<PreconWorkbookRow>("precon_workbooks").where({ session_id: sessionId }).first(),

    /**
     * The first save. Fails loudly on a duplicate key rather than upserting:
     * two concurrent first saves are a conflict the caller must see, not a
     * silent last-write-wins over a document nobody reviewed.
     */
    insertWorkbook: async (row: WorkbookInsert): Promise<PreconWorkbookRow> => {
      const [inserted] = await db<PreconWorkbookRow>("precon_workbooks")
        .insert({ ...row, snapshot: json(row.snapshot), layout: json(row.layout) })
        .returning("*");
      return inserted!;
    },

    /** Optimistic concurrency: `null` when the stored version is not the one expected. */
    updateWorkbookVersioned: async (
      sessionId: string,
      expectedVersion: number,
      patch: Pick<PreconWorkbookRow, "snapshot" | "layout" | "version" | "engine_version" | "source_fingerprint"> & {
        updated_by: string | null;
      },
    ): Promise<PreconWorkbookRow | null> => {
      const rows = await db<PreconWorkbookRow>("precon_workbooks")
        .where({ session_id: sessionId, version: expectedVersion })
        .update(
          {
            ...patch,
            snapshot: json(patch.snapshot),
            layout: json(patch.layout),
            updated_at: db.fn.now(),
          },
          "*",
        );
      return (rows as PreconWorkbookRow[])[0] ?? null;
    },

    // ---------------------------------------------------------------- sources

    sessionById: (sessionId: string) =>
      db<PreconSessionRow>("precon_sessions").where({ id: sessionId }).first(),

    billsBySession: (sessionId: string) =>
      db<PreconBillRow>("precon_bills").where({ session_id: sessionId }).orderBy("sort", "asc").orderBy("id", "asc"),

    /**
     * Every line the take-off has ever had, tombstones included, in the order
     * the bill reads. The `id` tiebreak makes the order total: two lines with
     * the same `sort` must not swap slots between two reads of the same data.
     */
    sourceRowsIncludingWithdrawn: (sessionId: string) =>
      db<PreconBoqRowRow>("precon_boq_rows")
        .whereIn("bill_id", db("precon_bills").select("id").where({ session_id: sessionId }))
        .orderBy("sort", "asc")
        .orderBy("id", "asc"),

    /** Live annotations only: a withdrawn one is no longer evidence for a figure. */
    activeGeometriesBySession: (sessionId: string) =>
      db<PreconGeometryRow>("precon_geometries")
        .whereIn(
          "row_id",
          db("precon_boq_rows")
            .select("id")
            .whereIn("bill_id", db("precon_bills").select("id").where({ session_id: sessionId })),
        )
        .whereNull("deleted_at")
        .orderBy("id", "asc"),

    sheetsBySession: (sessionId: string) =>
      db<PreconSheetRow>("precon_sheets").where({ session_id: sessionId }).orderBy("id", "asc"),

    /** The lines named by a patch, scoped to this take-off so a foreign id finds nothing. */
    rowsInSessionByIds: (sessionId: string, ids: string[]) =>
      ids.length
        ? db<PreconBoqRowRow>("precon_boq_rows")
            .whereIn("id", ids)
            .whereIn("bill_id", db("precon_bills").select("id").where({ session_id: sessionId }))
        : Promise.resolve([]),

    // ---------------------------------------------------------------- history

    /** This module's own entries, newest first. Never another feature's. */
    workbookEventsForSession: (sessionId: string, limit: number) =>
      db<PreconAuditEventRow>("precon_audit_events")
        .where({ session_id: sessionId })
        .whereIn("action", [...WORKBOOK_ACTIONS])
        .whereNotNull("operation_id")
        .orderBy("created_at", "desc")
        .orderBy("id", "desc")
        .limit(limit),

    workbookEventById: (eventId: string) =>
      db<PreconAuditEventRow>("precon_audit_events")
        .where({ id: eventId })
        .whereIn("action", [...WORKBOOK_ACTIONS])
        .first(),

    /** The committed record of one operation id — what makes a retry idempotent. */
    workbookEventByOperation: (sessionId: string, actor: string, operationId: string) =>
      db<PreconAuditEventRow>("precon_audit_events")
        .where({ session_id: sessionId, actor, operation_id: operationId })
        .whereIn("action", [...WORKBOOK_ACTIONS])
        .first(),

    workbookEventReversing: (eventId: string) =>
      db<PreconAuditEventRow>("precon_audit_events")
        .where({ reverses_event_id: eventId })
        .whereIn("action", [...WORKBOOK_ACTIONS])
        .first(),

    /** Workbook entries committed after one event — what makes a later undo unsafe. */
    workbookEventsAfter: (sessionId: string, after: Date) =>
      db<PreconAuditEventRow>("precon_audit_events")
        .where({ session_id: sessionId })
        .whereIn("action", [...WORKBOOK_ACTIONS])
        .whereNotNull("operation_id")
        .where("created_at", ">", after)
        .orderBy("created_at", "asc"),

    insertWorkbookEvent: (row: Omit<PreconAuditEventRow, "created_at">) =>
      db<PreconAuditEventRow>("precon_audit_events").insert({
        ...row,
        before: row.before === null ? null : json(row.before),
        after: row.after === null ? null : json(row.after),
      }),
  };
}
