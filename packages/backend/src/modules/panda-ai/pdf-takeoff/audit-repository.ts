import type { Knex } from "knex";
import type { PreconAuditEventRow } from "./types.ts";

export type PreconAuditRepository = ReturnType<typeof preconAuditRepository>;

export function preconAuditRepository(db: Knex) {
  return {
    insertAuditEvent: (row: Omit<PreconAuditEventRow, "created_at">) =>
      db<PreconAuditEventRow>("precon_audit_events").insert({
        ...row,
        before: row.before === null ? null : (JSON.stringify(row.before) as never),
        after: row.after === null ? null : (JSON.stringify(row.after) as never),
      }),
    auditEventsForRow: (rowId: string) =>
      db<PreconAuditEventRow>("precon_audit_events").where({ row_id: rowId }).orderBy("created_at", "asc"),
    auditEventById: (id: string) => db<PreconAuditEventRow>("precon_audit_events").where({ id }).first(),
    // An undo names the entry it reverses, so an entry that is already named is
    // already undone: reversing it twice would restore a line the QS removed.
    auditEventReversing: (eventId: string) =>
      db<PreconAuditEventRow>("precon_audit_events").where({ reverses_event_id: eventId }).first(),
    // The partial unique index on (session_id, actor, operation_id) makes a
    // retried undo idempotent: the first attempt's receipt is here.
    auditEventByOperation: (sessionId: string, actor: string, operationId: string) =>
      db<PreconAuditEventRow>("precon_audit_events")
        .where({ session_id: sessionId, actor, operation_id: operationId })
        .first(),

    // The reversible entries only: an ambient recompute or an AI run carries no
    // operation id and is nobody's edit to undo.
    operationsForSession: (sessionId: string, limit: number) =>
      db<PreconAuditEventRow>("precon_audit_events")
        .where({ session_id: sessionId })
        .whereNotNull("operation_id")
        .orderBy("created_at", "desc")
        .limit(limit),

    // What happened to these lines AFTER the entry being reversed. A reversal is
    // only safe if every one of them is a compensation on this actor's own undo
    // chain: a colleague's edit in between means undoing would silently discard
    // their work, and that stays true even when their value happens to match.
    operationsTouchingRowsAfter: (sessionId: string, rowIds: string[], after: Date) =>
      rowIds.length
        ? db<PreconAuditEventRow>("precon_audit_events")
            .where({ session_id: sessionId })
            .whereIn("row_id", rowIds)
            .whereNotNull("operation_id")
            .where("created_at", ">", after)
            .orderBy("created_at", "asc")
        : Promise.resolve([]),

    reversalsOf: (eventIds: string[]) =>
      eventIds.length
        ? db<PreconAuditEventRow>("precon_audit_events").whereIn("reverses_event_id", eventIds)
        : Promise.resolve([]),
  };
}
