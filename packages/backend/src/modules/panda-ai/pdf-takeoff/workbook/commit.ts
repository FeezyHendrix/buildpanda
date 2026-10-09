// The one place a workbook is written, used by both a save and an undo.
//
// An undo is not a rewind, it is a second attributed act that restores an
// earlier state — so it must land through exactly the same checks a save does:
// same lock, same version arithmetic, same audit entry, same refusals. Giving
// it its own write path would be two implementations of "commit a workbook",
// and the second one would be the one that eventually skipped a check.
//
// Everything the caller checked before calculating is checked AGAIN in here,
// after the worker has finished and inside the lock. That repetition is the
// point: the earlier checks only exist to avoid paying for a worker that was
// never going to commit, and these are the ones that decide.

import type { Knex } from "knex";
import { ConflictError } from "../../../../lib/errors.ts";
import { generateId } from "../../../../lib/ids.ts";
import { buildRowUpdatePatch } from "../row-patch.ts";
import { preconRowRepository } from "../row-repository.ts";
import { lockSession } from "../session-lock.ts";
import { auditPayload, recordedFingerprint, receiptOf, stateAfter, stateBefore } from "./audit.ts";
import { documentOf, liveRowsById } from "./document.ts";
import { sourceFingerprint } from "./fingerprint.ts";
import { preconWorkbookRepository } from "./repository.ts";
import { reReadUnderLock, type WorkbookSourceSet } from "./source.ts";
import { WORKBOOK_ENGINE_VERSION } from "./layout.ts";
import type { EvaluateWorkbookResult } from "./engine-types.ts";
import type {
  PreconWorkbookRow,
  WorkbookAction,
  WorkbookChangeEvent,
  WorkbookDocument,
  WorkbookLayout,
  WorkbookReceipt,
  WorkbookRowPatch,
  WorkbookSaveResult,
} from "./types.ts";
import type { PreconAuditEventRow, PreconBoqRowRow } from "../types.ts";

export const STALE_SOURCES =
  "The measurements behind this workbook changed while you were editing. " +
  "Your work is not lost — reload to pick up the new figures, then reapply it.";

export const STALE_WORKBOOK =
  "This workbook was saved by someone else while you were editing. " +
  "Your work is not lost — compare the two versions and reapply what you want to keep.";

export const REUSED_ID =
  "That save id was already used for a different change. Reload the workbook and save again — " +
  "replaying the first receipt would report success for work that never happened.";

/** Postgres `unique_violation`: the partial index on (session, actor, operation_id). */
const UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === UNIQUE_VIOLATION;
}

export interface ExpectedState {
  readonly expectedVersion: number;
  readonly expectedSourceFingerprint: string;
}

/** Refuses unless the workbook and the measurements are both where the caller left them. */
export function assertFresh(
  stored: PreconWorkbookRow | undefined,
  source: WorkbookSourceSet,
  expected: ExpectedState,
): string {
  const fingerprint = sourceFingerprint(source);
  if (fingerprint !== expected.expectedSourceFingerprint) throw new ConflictError(STALE_SOURCES);
  if ((stored?.version ?? 0) !== expected.expectedVersion) throw new ConflictError(STALE_WORKBOOK);
  return fingerprint;
}

function sourceWithRows(source: WorkbookSourceSet, replaced: ReadonlyMap<string, PreconBoqRowRow>): WorkbookSourceSet {
  return { ...source, rows: source.rows.map((row) => replaced.get(row.id) ?? row) };
}

export function replayReceipt(event: PreconAuditEventRow, fingerprint: string): WorkbookReceipt {
  if (recordedFingerprint(event) !== fingerprint) throw new ConflictError(REUSED_ID);
  const receipt = receiptOf(event);
  if (!receipt) throw new ConflictError(REUSED_ID);
  return receipt;
}

export interface CommitInput {
  readonly sessionId: string;
  readonly operationId: string;
  readonly actor: string;
  readonly expected: ExpectedState;
  /** SHA-256 of the request, so a retry is recognised and a reused id refused. */
  readonly requestFingerprint: string;
  readonly layout: WorkbookLayout;
  readonly evaluated: EvaluateWorkbookResult;
  readonly rowPatches: readonly WorkbookRowPatch[];
  readonly action: WorkbookAction;
  readonly reversesEventId?: string;
}

export type CommitOutcome =
  | { readonly replayed: true; readonly event: PreconAuditEventRow; readonly receipt: WorkbookReceipt }
  | {
      readonly replayed: false;
      readonly result: WorkbookSaveResult;
      /**
       * Handed back rather than published from in here. A broadcast sent inside
       * the transaction announces a change that can still roll back, so the
       * caller publishes it once `commitWorkbook` has resolved — which it only
       * does after the commit.
       */
      readonly broadcast: WorkbookChangeEvent;
    };

/**
 * Apply the row patches and store the calculated workbook, or refuse and write
 * nothing at all. The returned document carries the values the worker produced;
 * it is never recalculated here, because a worker inside this lock is exactly
 * what contract 5 forbids.
 */
export function commitWorkbook(db: Knex, input: CommitInput): Promise<CommitOutcome> {
  return db.transaction(async (trx) => {
    await lockSession(trx, input.sessionId, "wait");
    const repo = preconWorkbookRepository(trx);

    const committed = await repo.workbookEventByOperation(input.sessionId, input.actor, input.operationId);
    if (committed) {
      return { replayed: true, event: committed, receipt: replayReceipt(committed, input.requestFingerprint) };
    }

    const fresh = await reReadUnderLock(trx, input.sessionId);
    assertFresh(fresh.stored, fresh.source, input.expected);

    const rowRepo = preconRowRepository(trx);
    const live = liveRowsById(fresh.source);
    const before: PreconBoqRowRow[] = [];
    const after: PreconBoqRowRow[] = [];

    for (const patch of input.rowPatches) {
      const row = live.get(patch.rowId);
      if (!row || row.version !== patch.version) throw new ConflictError(STALE_SOURCES);
      before.push(row);
      const plan = buildRowUpdatePatch(
        row,
        {
          ...(patch.description === undefined ? {} : { description: patch.description }),
          ...(patch.rate === undefined ? {} : { rate: patch.rate }),
        },
        input.actor,
      );
      if (plan.noOp) {
        after.push(row);
        continue;
      }
      const updated = await rowRepo.updateRowVersioned(patch.rowId, patch.version, plan.patch, trx);
      if (!updated) throw new ConflictError(STALE_SOURCES);
      after.push(updated);
    }

    const version = (fresh.stored?.version ?? 0) + 1;
    const patched = new Map(after.map((row) => [row.id, row]));
    const storedFingerprint = sourceFingerprint(sourceWithRows(fresh.source, patched));
    const eventId = generateId("pae");
    const receipt: WorkbookReceipt = {
      eventId,
      operationId: input.operationId,
      version,
      sourceFingerprint: storedFingerprint,
      rows: after.map((row) => ({ id: row.id, version: row.version })),
    };

    const payload = auditPayload(
      stateBefore(fresh.stored, before),
      stateAfter(version, input.evaluated.snapshot, input.layout, storedFingerprint, after),
      input.requestFingerprint,
      receipt,
    );

    const record = {
      snapshot: input.evaluated.snapshot,
      layout: input.layout,
      version,
      engine_version: WORKBOOK_ENGINE_VERSION,
      source_fingerprint: storedFingerprint,
      updated_by: input.actor,
    };
    const written = fresh.stored
      ? await repo.updateWorkbookVersioned(input.sessionId, fresh.stored.version, record)
      : await repo.insertWorkbook({ session_id: input.sessionId, ...record });
    if (!written) throw new ConflictError(STALE_WORKBOOK);

    await repo.insertWorkbookEvent({
      id: eventId,
      session_id: input.sessionId,
      row_id: after[0]?.id ?? null,
      actor: input.actor,
      action: input.action,
      before: payload.before as unknown as Record<string, unknown>,
      after: payload.after as unknown as Record<string, unknown>,
      operation_id: input.operationId,
      reverses_event_id: input.reversesEventId ?? null,
    });

    const document: WorkbookDocument = documentOf({
      sessionId: input.sessionId,
      version,
      snapshot: input.evaluated.snapshot,
      layout: input.layout,
      values: input.evaluated.values,
      errors: input.evaluated.errors,
      sourceFingerprint: storedFingerprint,
      rows: new Map([...live, ...patched]),
      sourcesMoved: false,
      updatedAt: new Date(written.updated_at).toISOString(),
      updatedBy: input.actor,
      history: [],
    });

    return {
      replayed: false,
      result: { eventId, operationId: input.operationId, replayed: false, receipt, document },
      broadcast: {
        type: "workbook.updated",
        sessionId: input.sessionId,
        version,
        actor: input.actor,
        eventId,
        operationId: input.operationId,
        action: input.action,
        sourceFingerprint: storedFingerprint,
        rows: receipt.rows,
      },
    };
  });
}
