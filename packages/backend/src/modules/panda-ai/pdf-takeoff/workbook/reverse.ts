// Undo as a compensating save, not a rewind.
//
// A take-off is a contractual record, so the way to undo a change is to record
// a SECOND attributed act that restores the earlier state, leaving both entries
// in the trail. Nothing is rewritten and nothing is erased: versions only ever
// go up, and a dispute can still read what was claimed, when it changed, and
// who changed it back.
//
// It restores the USER's document and the rates and descriptions the entry
// moved. It does NOT restore measured quantities — those are rebuilt from the
// bill as it stands right now, because a measurement taken since the edit is
// current truth and an undo of a spreadsheet must not discard it.
//
// And it never restores a verification stamp. The recorded status is read for
// comparison only; the write goes through `buildRowUpdatePatch`, whose review
// policy can clear a sign-off and can never confer one.

import { ForbiddenError, NotFoundError } from "../../../../lib/errors.ts";
import { num } from "../dto.ts";
import { directionOfDepth } from "../editor-reverse-service.ts";
import { recordedAfter, recordedBefore } from "./audit.ts";
import { assertFresh, commitWorkbook, replayReceipt } from "./commit.ts";
import { liveRowsById } from "./document.ts";
import { evaluateWorkbook } from "./engine.ts";
import { reverseFingerprint } from "./fingerprint.ts";
import { eligibilityOf, WORKBOOK_REFUSALS } from "./history.ts";
import { preconWorkbookRepository } from "./repository.ts";
import { renderTrusted, type WorkbookService } from "./service.ts";
import { readCoherentState } from "./source.ts";
import type { Knex } from "knex";
import type { PublishFn } from "../service.ts";
import type { PreconAuditEventRow, PreconBoqRowRow } from "../types.ts";
import type {
  WorkbookReverseDirection,
  WorkbookReverseRequest,
  WorkbookReverseResult,
  WorkbookRowDelta,
  WorkbookRowPatch,
  WorkbookStateV1,
} from "./types.ts";

const refused = (reason: string): WorkbookReverseResult => ({ ok: true, reversed: false, reason });

/** A line still says what the entry left it saying. Anything else is someone else's work. */
function unchangedSince(row: PreconBoqRowRow | undefined, recorded: WorkbookRowDelta): boolean {
  if (!row) return false;
  return row.description === recorded.description && num(row.rate) === recorded.rate;
}

/**
 * The patches that put the recorded lines back, addressed at their versions as
 * they stand now. A line the entry left untouched is not patched at all, so an
 * undo never writes to a line it had no part in.
 */
export function restorePatches(
  target: WorkbookStateV1,
  committed: WorkbookStateV1,
  live: ReadonlyMap<string, PreconBoqRowRow>,
): WorkbookRowPatch[] | null {
  const patches: WorkbookRowPatch[] = [];
  for (const [rowId, recorded] of Object.entries(committed.rows)) {
    const row = live.get(rowId);
    if (!unchangedSince(row, recorded)) return null;
    const restore = target.rows[rowId];
    if (!restore) continue;
    if (restore.description === recorded.description && restore.rate === recorded.rate) continue;
    patches.push({ rowId, version: row!.version, description: restore.description, rate: restore.rate });
  }
  return patches;
}

export function workbookReverseService(db: Knex, service: WorkbookService, publish: PublishFn = () => {}) {
  const repo = preconWorkbookRepository(db);

  /** Parity of the entry's depth in its compensation chain: an undo of an undo is a redo. */
  async function directionOf(event: PreconAuditEventRow): Promise<WorkbookReverseDirection> {
    let depth = 0;
    let current: string | null = event.reverses_event_id ?? null;
    const seen = new Set<string>([event.id]);
    while (current && !seen.has(current)) {
      seen.add(current);
      depth += 1;
      const parent: PreconAuditEventRow | undefined = await repo.workbookEventById(current);
      current = parent?.reverses_event_id ?? null;
    }
    return directionOfDepth(depth);
  }

  return {
    async reverse(
      sessionId: string,
      eventId: string,
      request: WorkbookReverseRequest,
      actor: string,
      signal?: AbortSignal,
    ): Promise<WorkbookReverseResult> {
      const requestFingerprint = reverseFingerprint(eventId, request);

      const replay = await repo.workbookEventByOperation(sessionId, actor, request.operationId);
      if (replay) {
        const receipt = replayReceipt(replay, requestFingerprint);
        return {
          ok: true,
          reversed: true,
          direction: await directionOf(replay),
          eventId: replay.id,
          operationId: receipt.operationId,
          replayed: true,
          receipt,
          document: await service.readOnce(sessionId, actor),
        };
      }

      const event = await repo.workbookEventById(eventId);
      // Same 404 for "not here" and "not a workbook entry": an event id must not
      // be a way to learn that another take-off's edit exists.
      if (!event || event.session_id !== sessionId) throw new NotFoundError("Audit event");
      if (event.actor !== actor) throw new ForbiddenError(WORKBOOK_REFUSALS.notYours);

      const [later, reversedBy] = await Promise.all([
        repo.workbookEventsAfter(sessionId, event.created_at),
        repo.workbookEventReversing(eventId),
      ]);
      const eligibility = eligibilityOf(event, later, reversedBy?.id ?? null, actor);
      if (!eligibility.eligible) return refused(eligibility.reason ?? WORKBOOK_REFUSALS.movedOn);

      const target = recordedBefore(event);
      const committed = recordedAfter(event);
      if (!target || !committed) return refused(WORKBOOK_REFUSALS.noState);

      const { source, stored } = await readCoherentState(db, sessionId);
      assertFresh(stored, source, request);

      const patches = restorePatches(target, committed, liveRowsById(source));
      if (patches === null) return refused(WORKBOOK_REFUSALS.sourcesMoved);

      // Rendered through the same function a save renders with, but without the
      // candidate gate: what is being put back is the user half of a document
      // this server recorded, which that gate had already passed once.
      const rendered = renderTrusted(source, stored, target.snapshot, patches, actor);
      const evaluated = await evaluateWorkbook(rendered.snapshot, {
        jobId: request.operationId,
        ...(signal ? { signal } : {}),
      });

      const direction = await directionOf(event);
      const outcome = await commitWorkbook(db, {
        sessionId,
        operationId: request.operationId,
        actor,
        expected: request,
        requestFingerprint,
        layout: rendered.layout,
        evaluated,
        rowPatches: patches,
        action: "workbook_reversed",
        reversesEventId: eventId,
      });

      if (outcome.replayed) {
        return {
          ok: true,
          reversed: true,
          direction,
          eventId: outcome.event.id,
          operationId: outcome.receipt.operationId,
          replayed: true,
          receipt: outcome.receipt,
          document: await service.readOnce(sessionId, actor),
        };
      }

      publish(sessionId, outcome.broadcast);
      return {
        ok: true,
        reversed: true,
        direction,
        eventId: outcome.result.eventId,
        operationId: outcome.result.operationId,
        replayed: false,
        receipt: outcome.result.receipt,
        document: {
          ...outcome.result.document,
          history: await service.historyFor(sessionId, actor),
        },
      };
    },
  };
}
