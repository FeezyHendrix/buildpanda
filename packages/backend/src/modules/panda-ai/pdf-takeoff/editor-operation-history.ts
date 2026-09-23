// The undo stack, rebuilt from the audit trail rather than remembered.
//
// Draft history lives in the browser and dies on refresh. Persisted history has
// to survive it, so it is folded out of the trail on every read: each operation
// entry is paired with the compensation that reversed it, entries that are
// themselves compensations become the REDO side, and an entry whose lines have
// since moved under a colleague is reported as ineligible WITH its reason rather
// than silently dropped — a greyed-out undo that explains itself is usable, a
// missing one is not.
//
// This is metadata only. A hundred entries' worth of geometry would be megabytes
// per sheet, so the receipt for one entry is fetched separately (contract 18).

import { NotFoundError } from "../../../lib/errors.ts";
import type { PreconAuditRepository } from "./audit-repository.ts";
import type {
  OperationAuditAfter,
  OperationAuditBefore,
  OperationHistory,
  OperationHistoryEntry,
  OperationReceiptRecord,
} from "./editor-operation-types.ts";
import { chainDepth, chainIsClean, directionOfDepth, REVERSE_REFUSALS } from "./editor-reverse-service.ts";
import type { PreconAuditEventRow } from "./types.ts";

export const HISTORY_LIMIT = 100;

/** Read a generous window, because folding discards the entries already undone. */
const SCAN_MULTIPLIER = 4;

function receiptOf(event: PreconAuditEventRow): OperationAuditAfter["receipt"] | null {
  return (event.after as OperationAuditAfter | null)?.receipt ?? null;
}

function sheetIdsOf(event: PreconAuditEventRow): string[] {
  return receiptOf(event)?.touchedSheetIds ?? [];
}

function rowIdsOf(event: PreconAuditEventRow): string[] {
  const receipt = receiptOf(event);
  if (receipt) return receipt.rows.map((row) => row.id);
  return event.row_id ? [event.row_id] : [];
}

function hasRecordedState(event: PreconAuditEventRow): boolean {
  const before = event.before as OperationAuditBefore | null;
  return before?.schemaVersion === 1 && Boolean(receiptOf(event));
}

export function editorHistoryService(audits: PreconAuditRepository) {
  return {
    /**
     * The caller's own reversible entries on one sheet, newest first. Scoped to
     * the actor because undo is personal: showing a colleague's edits as
     * undoable would offer an action the reverse endpoint refuses.
     */
    async history(
      sessionId: string,
      actor: string,
      sheetId?: string,
      limit: number = HISTORY_LIMIT,
    ): Promise<OperationHistory> {
      const capped = Math.min(Math.max(limit, 1), HISTORY_LIMIT);
      const scanned = await audits.operationsForSession(sessionId, capped * SCAN_MULTIPLIER);
      const mine = scanned.filter((event) => event.actor === actor);
      const onSheet = sheetId ? mine.filter((event) => sheetIdsOf(event).includes(sheetId)) : mine;

      const reversals = await audits.reversalsOf(onSheet.map((event) => event.id));
      // The whole scanned window, so a chain whose links are outside the
      // sheet filter still resolves to the right parity.
      const reversesById = new Map(scanned.map((event) => [event.id, event.reverses_event_id ?? null] as const));
      const reversedBy = new Map(
        reversals.map((reversal) => [reversal.reverses_event_id ?? "", reversal.id] as const),
      );

      const operations: OperationHistoryEntry[] = [];
      for (const event of onSheet) {
        if (operations.length >= capped) break;
        const rowIds = rowIdsOf(event);
        const reversedByEventId = reversedBy.get(event.id) ?? null;

        let eligible = true;
        let reason: string | null = null;
        if (reversedByEventId) {
          eligible = false;
          reason = REVERSE_REFUSALS.alreadyReversed;
        } else if (!hasRecordedState(event)) {
          eligible = false;
          reason = REVERSE_REFUSALS.noState;
        } else if (!(await chainIsClean(audits, sessionId, event, rowIds, actor))) {
          eligible = false;
          reason = "Those lines have been edited since";
        }

        operations.push({
          eventId: event.id,
          operationId: event.operation_id ?? "",
          action: event.action,
          actor: event.actor,
          createdAt: new Date(event.created_at).toISOString(),
          rowIds,
          sheetIds: sheetIdsOf(event),
          reversesEventId: event.reverses_event_id ?? null,
          reversedByEventId,
          direction: directionOfDepth(chainDepth(event.id, reversesById)),
          eligible,
          reason,
        });
      }
      return { operations };
    },

    /** One entry's full receipt, including the before/after it recorded. */
    async receipt(sessionId: string, eventId: string, actor: string): Promise<OperationReceiptRecord> {
      const event = await audits.auditEventById(eventId);
      // Same 404 for "not here" and "not yours": a receipt id must not be a way
      // to learn that another organisation's edit exists.
      if (!event || event.session_id !== sessionId || event.actor !== actor) {
        throw new NotFoundError("Audit event");
      }
      const before = event.before as OperationAuditBefore | null;
      const after = event.after as OperationAuditAfter | null;
      return {
        eventId: event.id,
        operationId: event.operation_id ?? "",
        action: event.action,
        actor: event.actor,
        createdAt: new Date(event.created_at).toISOString(),
        reversesEventId: event.reverses_event_id ?? null,
        requestFingerprint: after?.requestFingerprint ?? null,
        before: before?.schemaVersion === 1 ? before.state : null,
        after: after?.schemaVersion === 1 ? after.state : null,
        receipt: after?.receipt ?? null,
      };
    },
  };
}
