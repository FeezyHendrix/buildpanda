// Undo as a compensating operation, not a rewind.
//
// A take-off is a contractual record: the way to undo a correction is to record a
// second, attributed act that restores the earlier figure, leaving both entries in
// the trail. Nothing is rewritten or erased, so a dispute can still read what was
// claimed, when it changed, and who changed it back.
//
// Reversal is GENERIC here. An earlier version could only put back a deleted row
// and refused every geometry edit with "not yet implemented"; now each operation
// records the complete editable state of everything it touched, so undoing any of
// them is one act: write the recorded `before` back. Redo is the same act applied
// to the compensation — reversing an undo restores the edit it withdrew.
//
// Three refusals matter more than convenience:
//   * Only your own edit. Undo withdraws your act, never a colleague's.
//   * Only if nothing else has happened to those lines since. A colleague's edit
//     in between makes the reversal unsafe EVEN IF their value matches, because
//     undoing would discard work nobody reviewed.
//   * Never a verification stamp. A restored figure is signed off by nobody.

import { ConflictError, ForbiddenError, NotFoundError } from "../../../lib/errors.ts";
import { generateId } from "../../../lib/ids.ts";
import { reverseFingerprint } from "./editor-fingerprint.ts";
import { receiptOfEvent } from "./editor-operation-service.ts";
import { captureState, firstDifference, statesMatch } from "./editor-operation-state.ts";
import { markupAwareReader } from "./editor-markup-writers.ts";
import { applyState, sheetsOf, type AppliedState } from "./editor-reverse-apply.ts";
import type {
  EditorGrants,
  OperationAuditAfter,
  OperationAuditBefore,
  OperationReceipt,
  OperationStateV1,
  ReverseDirection,
  ReverseOperationOutcome,
} from "./editor-operation-types.ts";
import type { WithOperationWrite } from "./editor-unit-of-work.ts";
import type { PreconAuditEventRow, ReverseOperationBody } from "./types.ts";

export const REVERSE_REFUSALS = {
  notAnOperation: "That entry predates reversible edits, so there is nothing to compensate for",
  alreadyReversed: "That edit has already been undone",
  noState: "That entry did not record the state it changed, so it cannot be put back",
} as const;

const FOREIGN_EDIT =
  "Those lines have been edited since, so undoing would discard work you have not seen. Refresh and reapply.";

const MOVED_ON = "Those lines no longer match what that edit left behind; refresh and reapply";

function refused(reason: string): ReverseOperationOutcome {
  return { ok: true, reversed: false, reason };
}

function recordedBefore(event: PreconAuditEventRow): OperationStateV1 | null {
  const before = event.before as OperationAuditBefore | null;
  return before?.schemaVersion === 1 ? before.state : null;
}

function recordedAfter(event: PreconAuditEventRow): OperationStateV1 | null {
  const after = event.after as OperationAuditAfter | null;
  return after?.schemaVersion === 1 ? after.state : null;
}

/**
 * Whether reversing this entry UNDOES an edit or REDOES one.
 *
 * It is the parity of the entry's depth in its compensation chain, not merely
 * whether it compensates for something. An edit is depth 0, so reversing it
 * undoes. Its undo is depth 1, so reversing that redoes. The redo is depth 2 —
 * and reversing THAT undoes again. The old rule only asked "does this reverse
 * something?", so every compensation reported "redo" forever and the client had
 * to fold the parity itself.
 *
 * `chain` maps event id to the entry it reverses; a missing link ends the walk,
 * which is the honest answer for a chain whose head is outside the window read.
 */
export function directionOfDepth(depth: number): ReverseDirection {
  return depth % 2 === 0 ? "undo" : "redo";
}

export function chainDepth(eventId: string | null, reversesById: Map<string, string | null>): number {
  let depth = 0;
  let current = eventId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const parent = reversesById.get(current);
    if (!parent) break;
    depth += 1;
    current = parent;
  }
  return depth;
}

/** The same answer for one event, reading the chain from the audit trail. */
export async function directionOfEvent(
  event: PreconAuditEventRow,
  byId: (id: string) => PromiseLike<PreconAuditEventRow | undefined>,
): Promise<ReverseDirection> {
  let depth = 0;
  let current: string | null | undefined = event.reverses_event_id ?? null;
  const seen = new Set<string>([event.id]);
  while (current && !seen.has(current)) {
    seen.add(current);
    depth += 1;
    const parent = await byId(current);
    current = parent?.reverses_event_id ?? null;
  }
  return directionOfDepth(depth);
}

export interface ReverseAuditReader {
  auditEventById(id: string): PromiseLike<PreconAuditEventRow | undefined>;
  auditEventReversing(eventId: string): PromiseLike<PreconAuditEventRow | undefined>;
  operationsTouchingRowsAfter(sessionId: string, rowIds: string[], after: Date): PromiseLike<PreconAuditEventRow[]>;
  reversalsOf(eventIds: string[]): PromiseLike<PreconAuditEventRow[]>;
}

/**
 * Whether everything that happened to these lines after `event` belongs to this
 * actor's own undo chain. An intervening entry is acceptable when it is itself a
 * compensation by this actor, or when it is an edit by this actor that a later
 * compensation has already withdrawn — which is exactly the A→B→undoB→undoA case.
 * Anything else, including a colleague's edit with an identical value, is not.
 */
export async function chainIsClean(
  audits: ReverseAuditReader,
  sessionId: string,
  event: PreconAuditEventRow,
  rowIds: string[],
  actor: string,
): Promise<boolean> {
  const later = await audits.operationsTouchingRowsAfter(sessionId, rowIds, event.created_at);
  const intervening = later.filter((candidate) => candidate.id !== event.id);
  if (intervening.length === 0) return true;
  if (intervening.some((candidate) => candidate.actor !== actor)) return false;

  const compensated = new Set(
    (await audits.reversalsOf(intervening.map((candidate) => candidate.id)))
      .filter((reversal) => reversal.actor === actor)
      .map((reversal) => reversal.reverses_event_id),
  );
  return intervening.every((candidate) => candidate.reverses_event_id !== null || compensated.has(candidate.id));
}

function receiptFor(
  compensationId: string,
  operationId: string,
  target: OperationStateV1,
  applied: AppliedState,
  committed?: OperationStateV1,
): OperationReceipt {
  return {
    eventId: compensationId,
    operationId,
    replayed: false,
    rows: applied.rows,
    geometries: applied.restoredGeometryIds.map((id: string) => ({
      id,
      rowId: target.geometries[id]?.rowId ?? "",
      sheetId: target.geometries[id]?.sheetId ?? "",
    })),
    deletedRowIds: Object.entries(target.rows)
      .filter(([, recorded]) => recorded === null || recorded.deleted)
      .map(([id]) => id),
    deletedGeometryIds: applied.tombstonedGeometryIds,
    touchedSheetIds: sheetsOf(target, committed),
  };
}

export function editorReverseServiceWith(withOperationWrite: WithOperationWrite, audits: ReverseAuditReader) {
  return {
    reverseOperation(
      sessionId: string,
      eventId: string,
      body: ReverseOperationBody,
      actor: string,
      grants: EditorGrants,
    ): Promise<ReverseOperationOutcome> {
      // An undo is an edit, so it needs the grant an edit needs. It deliberately
      // does NOT need `verify`: reversing invalidates verification rather than
      // conferring it (contract 18).
      if (!grants.edit) throw new ForbiddenError("Your role does not allow you to edit takeoffs");
      const fingerprint = reverseFingerprint(eventId, body);

      return withOperationWrite(sessionId, async (ctx) => {
        const replay = await ctx.editor.findCommittedOperation(sessionId, actor, body.operationId);
        if (replay) {
          const receipt = receiptOfEvent(replay);
          const recorded = (replay.after as OperationAuditAfter | null)?.requestFingerprint;
          if (!receipt || recorded !== fingerprint) {
            throw new ConflictError("That undo id was already used for a different undo; reload and retry");
          }
          return {
            ok: true,
            reversed: true,
            direction: await directionOfEvent(replay, (id) => audits.auditEventById(id)),
            receipt,
          };
        }

        const event = await audits.auditEventById(eventId);
        if (!event || event.session_id !== sessionId) throw new NotFoundError("Audit event");
        if (event.actor !== actor) throw new ForbiddenError("You can only undo your own edits");
        if (!event.operation_id) return refused(REVERSE_REFUSALS.notAnOperation);
        if (await audits.auditEventReversing(eventId)) return refused(REVERSE_REFUSALS.alreadyReversed);

        const direction = await directionOfEvent(event, (id) => audits.auditEventById(id));
        const target = recordedBefore(event);
        const committed = recordedAfter(event);
        if (!target || !committed) return refused(REVERSE_REFUSALS.noState);

        const rowIds = Object.keys(committed.rows);
        // Sheets belong in the scope too, or the live read reports every drawing
        // the operation recorded as ABSENT and the semantic check always conflicts.
        const scope = {
          rowIds: [...new Set([...rowIds, ...Object.keys(target.rows)])],
          geometryIds: [...new Set([...Object.keys(committed.geometries), ...Object.keys(target.geometries)])],
          sheetIds: [...new Set([...Object.keys(committed.sheets ?? {}), ...Object.keys(target.sheets ?? {})])],
          markupIds: [...new Set([...Object.keys(committed.markups ?? {}), ...Object.keys(target.markups ?? {})])],
        };

        for (const { id, version } of body.expectedRows ?? []) {
          const row = await ctx.rows.rowByIdIncludeDeleted(id);
          if (!row) throw new NotFoundError("Row");
          if (row.version !== version) {
            throw new ConflictError(
              `Row was updated by someone else (current version ${row.version}); refresh and reapply`,
            );
          }
        }

        if (!(await chainIsClean(audits, sessionId, event, rowIds, actor))) throw new ConflictError(FOREIGN_EDIT);

        const live = await captureState(markupAwareReader(ctx, sessionId), scope);
        if (!statesMatch(committed, live)) {
          throw new ConflictError(`${MOVED_ON} (${firstDifference(committed, live) ?? "changed"})`);
        }

        // A redline whose thread moved on refuses from inside the markup module.
        // That is a REFUSAL with a reason, not a failure: the caller is being
        // told a person must decide, which is exactly what `refused` models.
        let applied: AppliedState;
        try {
          applied = await applyState(ctx, { state: target, actor, sessionId, ...(committed ? { committed } : {}) });
        } catch (error) {
          if (error instanceof ConflictError && Object.keys(target.markups ?? {}).length > 0) {
            return refused(error.message);
          }
          throw error;
        }
        const compensationId = generateId("pae");
        const receipt = receiptFor(compensationId, body.operationId, target, applied, committed);
        const after = await captureState(markupAwareReader(ctx, sessionId), scope);
        await ctx.editor.insertOperationAudit({
          id: compensationId,
          session_id: sessionId,
          row_id: applied.rows[0]?.id ?? event.row_id,
          actor,
          action: direction === "undo" ? "reversed" : "reapplied",
          before: { schemaVersion: 1, state: live } as unknown as Record<string, unknown>,
          after: {
            schemaVersion: 1,
            state: after,
            requestFingerprint: fingerprint,
            receipt,
          } as unknown as Record<string, unknown>,
          operation_id: body.operationId,
          reverses_event_id: eventId,
        });

        for (const { id, version } of applied.rows) {
          ctx.emit({ type: "row.updated", sessionId, rowId: id, version, actor, changes: { reversedEventId: eventId } });
        }
        return { ok: true, reversed: true, direction, receipt };
      });
    },
  };
}
