// The workbook's undo stack, folded out of the audit trail rather than
// remembered.
//
// A draft history lives in the browser and dies on refresh. This one has to
// survive it, so it is rebuilt on every read: each save is paired with the
// compensation that withdrew it, a compensation is itself the REDO side, and an
// entry that can no longer be reversed says why rather than disappearing — a
// greyed-out undo that explains itself is usable, a missing one is not.
//
// Scoped to the actor because undo is personal. Showing a colleague's save as
// undoable would offer an action the reverse endpoint refuses, and undoing it
// would discard work its author never agreed to lose.

import { chainDepth, directionOfDepth } from "../editor-reverse-service.ts";
import { recordedAfter, recordedBefore } from "./audit.ts";
import type { PreconWorkbookRepository } from "./repository.ts";
import type { WorkbookAction, WorkbookHistory, WorkbookHistoryEntry } from "./types.ts";
import type { PreconAuditEventRow } from "../types.ts";

export const WORKBOOK_HISTORY_LIMIT = 50;

/** Read a wider window than we return: folding discards entries already undone. */
const SCAN_MULTIPLIER = 4;

export const WORKBOOK_REFUSALS = {
  notYours: "You can only undo your own workbook changes",
  alreadyReversed: "That change has already been undone",
  noState: "That entry did not record the workbook it changed, so it cannot be put back",
  movedOn: "The workbook has been saved again since, so undoing would discard work you have not seen",
  sourcesMoved: "The measurements behind this workbook have changed since, so that undo is no longer safe to apply",
} as const;

function hasRecordedState(event: PreconAuditEventRow): boolean {
  return recordedBefore(event) !== null && recordedAfter(event) !== null;
}

/**
 * Whether everything that happened to this workbook after `event` belongs to
 * this actor's own undo chain.
 *
 * A colleague's save in between makes the reversal unsafe even if its content
 * matches, because undoing would silently discard their work. The actor's own
 * later save is equally disqualifying unless it has itself been compensated for
 * — which is what makes a new edit abandon redo eligibility without ever
 * erasing anything from the trail.
 */
export function workbookChainIsClean(
  event: PreconAuditEventRow,
  later: readonly PreconAuditEventRow[],
  actor: string,
): boolean {
  const intervening = later.filter((candidate) => candidate.id !== event.id);
  if (intervening.length === 0) return true;
  if (intervening.some((candidate) => candidate.actor !== actor)) return false;

  const compensated = new Set(
    intervening.filter((candidate) => candidate.reverses_event_id !== null).map((c) => c.reverses_event_id),
  );
  return intervening.every((candidate) => candidate.reverses_event_id !== null || compensated.has(candidate.id));
}

export interface WorkbookEligibility {
  readonly eligible: boolean;
  readonly reason: string | null;
}

export function eligibilityOf(
  event: PreconAuditEventRow,
  later: readonly PreconAuditEventRow[],
  reversedByEventId: string | null,
  actor: string,
): WorkbookEligibility {
  if (event.actor !== actor) return { eligible: false, reason: WORKBOOK_REFUSALS.notYours };
  if (reversedByEventId) return { eligible: false, reason: WORKBOOK_REFUSALS.alreadyReversed };
  if (!hasRecordedState(event)) return { eligible: false, reason: WORKBOOK_REFUSALS.noState };
  if (!workbookChainIsClean(event, later, actor)) return { eligible: false, reason: WORKBOOK_REFUSALS.movedOn };
  return { eligible: true, reason: null };
}

function entryOf(
  event: PreconAuditEventRow,
  reversesById: ReadonlyMap<string, string | null>,
  reversedByEventId: string | null,
  eligibility: WorkbookEligibility,
): WorkbookHistoryEntry {
  const before = recordedBefore(event);
  const after = recordedAfter(event);
  return {
    eventId: event.id,
    operationId: event.operation_id ?? "",
    action: event.action as WorkbookAction,
    actor: event.actor,
    createdAt: new Date(event.created_at).toISOString(),
    fromVersion: before?.version ?? 0,
    toVersion: after?.version ?? 0,
    rowIds: Object.keys(after?.rows ?? {}),
    reversesEventId: event.reverses_event_id ?? null,
    reversedByEventId,
    direction: directionOfDepth(chainDepth(event.id, new Map(reversesById))),
    eligible: eligibility.eligible,
    reason: eligibility.reason,
  };
}

export function workbookHistoryService(repo: PreconWorkbookRepository) {
  return {
    async history(sessionId: string, actor: string, limit: number = WORKBOOK_HISTORY_LIMIT): Promise<WorkbookHistory> {
      const capped = Math.min(Math.max(limit, 1), WORKBOOK_HISTORY_LIMIT);
      const scanned = await repo.workbookEventsForSession(sessionId, capped * SCAN_MULTIPLIER);
      const reversesById = new Map(scanned.map((event) => [event.id, event.reverses_event_id ?? null] as const));
      const reversedBy = new Map(
        scanned
          .filter((event) => event.reverses_event_id !== null)
          .map((event) => [event.reverses_event_id!, event.id] as const),
      );

      const operations: WorkbookHistoryEntry[] = [];
      for (const event of scanned) {
        if (event.actor !== actor) continue;
        if (operations.length >= capped) break;
        const later = scanned.filter((candidate) => candidate.created_at > event.created_at);
        const reversedByEventId = reversedBy.get(event.id) ?? null;
        operations.push(
          entryOf(event, reversesById, reversedByEventId, eligibilityOf(event, later, reversedByEventId, actor)),
        );
      }
      return { operations };
    },
  };
}
