// One save = one transaction, one lock, one audit event, one receipt.
//
// The order of the steps below is the whole safety argument, so it is spelled
// out rather than left to be inferred:
//
//   1. lock the session (waiting, so a retry queues behind the original)
//   2. INSIDE the lock, look for a committed operation with this id. A retry is
//      answered here, before any version is checked — the versions it sent were
//      current when it first tried, and refusing it for being stale would report
//      failure for an edit that landed.
//   3. compare fingerprints. Same id + same meaning = replay. Same id +
//      different meaning = the client reused an id for new work: 409, no write.
//   4. resolve what the command WOULD touch, and bound it, while nothing has
//      changed. Over the cap, nothing is written at all.
//   5. check every expected version against the live records.
//   6. capture `before`, execute, capture `after`.
//   7. write ONE audit event carrying before, after, fingerprint and receipt.
//   8. commit. Only then publish.
//
// Steps 6-8 share the transaction, so a failure anywhere leaves no quantity, no
// tombstone, no audit entry and no realtime event behind.

import type { Knex } from "knex";
import { ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { generateId } from "../../../lib/ids.ts";
import { preconAuditRepository } from "./audit-repository.ts";
import { requestFingerprint } from "./editor-fingerprint.ts";
import { assertAuditPayloadWithinCap } from "./editor-limits.ts";
import { assertGrants, execute, scopeOf, type CommandScope } from "./editor-operation-commands.ts";
import { markupAwareReader } from "./editor-markup-writers.ts";
import { captureState } from "./editor-operation-state.ts";
import type {
  EditorGrants,
  OperationStateV1,
  EditorOperationRequest,
  OperationAuditAfter,
  OperationAuditBefore,
  OperationReceipt,
} from "./editor-operation-types.ts";
import { assertOperationLimits } from "./editor-repository.ts";
import {
  createOperationUnitOfWork,
  type OperationWriteContext,
  type WithOperationWrite,
} from "./editor-unit-of-work.ts";
import type { PublishFn } from "./service.ts";
import type { ExpectedVersion, PreconAuditEventRow } from "./types.ts";

const REUSED_ID =
  "That save id was already used for a different edit. Reload the drawing and save again — " +
  "replaying the first receipt would report success for work that never happened.";

/** Postgres `unique_violation`: the partial index on (session, actor, operation_id). */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === UNIQUE_VIOLATION;
}

export function receiptOfEvent(event: PreconAuditEventRow): OperationReceipt | null {
  const receipt = (event.after as OperationAuditAfter | null)?.receipt;
  return receipt ? { ...receipt, eventId: event.id, replayed: true } : null;
}

/**
 * A retry answered from the first attempt's record. A fingerprint that disagrees
 * is a reused id, and an event that predates receipts has none to replay: both
 * are conflicts, never a silent success.
 */
function replayOf(event: PreconAuditEventRow, fingerprint: string): OperationReceipt {
  if ((event.after as OperationAuditAfter | null)?.requestFingerprint !== fingerprint) {
    throw new ConflictError(REUSED_ID);
  }
  const receipt = receiptOfEvent(event);
  if (!receipt) throw new ConflictError(REUSED_ID);
  return receipt;
}

async function assertVersions(
  expected: ExpectedVersion[] | undefined,
  read: (id: string) => PromiseLike<{ version?: number | null } | undefined>,
  what: string,
): Promise<void> {
  for (const { id, version } of expected ?? []) {
    const live = await read(id);
    if (!live) throw new NotFoundError(what);
    const current = live.version ?? 1;
    if (current !== version) {
      throw new ConflictError(`${what} was updated by someone else (current version ${current}); refresh and reapply`);
    }
  }
}

type Outcome = Awaited<ReturnType<typeof execute>>;

async function buildReceipt(
  ctx: OperationWriteContext,
  eventId: string,
  operationId: string,
  scope: CommandScope,
  outcome: Outcome,
  before: OperationStateV1,
): Promise<OperationReceipt> {
  const rows: ExpectedVersion[] = [];
  for (const id of new Set([...scope.rowIds, ...outcome.createdRowIds])) {
    const row = await ctx.rows.rowByIdIncludeDeleted(id);
    if (row) rows.push({ id, version: row.version });
  }
  const geometries: OperationReceipt["geometries"] = [];
  // Tombstoned subjects still name their drawing, and a delete has to record the
  // sheet it happened on or the sheet-scoped history loses the entry.
  const touchedSheetIds = new Set<string>(scope.sheetIds);
  for (const geometry of Object.values(before.geometries)) {
    if (geometry) touchedSheetIds.add(geometry.sheetId);
  }
  for (const id of new Set([...scope.geometryIds, ...outcome.createdGeometryIds])) {
    const geometry = await ctx.geometries.geometryByIdIncludeDeleted(id);
    if (!geometry) continue;
    touchedSheetIds.add(geometry.sheet_id);
    if (!geometry.deleted_at) geometries.push({ id, rowId: geometry.row_id, sheetId: geometry.sheet_id });
  }
  return {
    eventId,
    operationId,
    replayed: false,
    rows,
    geometries,
    deletedRowIds: outcome.deletedRowIds,
    deletedGeometryIds: outcome.deletedGeometryIds,
    touchedSheetIds: [...touchedSheetIds],
  };
}

export type CommittedOperationLookup = (
  sessionId: string,
  actor: string,
  operationId: string,
) => PromiseLike<PreconAuditEventRow | undefined>;

export function editorOperationServiceWith(
  withOperationWrite: WithOperationWrite,
  committedOperation: CommittedOperationLookup,
) {
  function attempt(
    sessionId: string,
    request: EditorOperationRequest,
    actor: string,
    fingerprint: string,
  ): Promise<OperationReceipt> {
    return withOperationWrite(sessionId, async (ctx) => {
      const committed = await ctx.editor.findCommittedOperation(sessionId, actor, request.operationId);
      if (committed) return replayOf(committed, fingerprint);

      const context = { ctx, sessionId, actor };
      const scope = await scopeOf(context, request.command);
      assertOperationLimits({
        ...scope,
        markupIds: [...new Set([...scope.markupIds, ...(request.expectedMarkups ?? []).map((m) => m.id)])],
      });

      await assertVersions(request.expectedRows, (id) => ctx.rows.rowByIdIncludeDeleted(id), "Row");
      await assertVersions(request.expectedSheets, (id) => ctx.sheets.sheetById(id), "Sheet");

      const before = await captureState(markupAwareReader(ctx, sessionId), scope);
      const outcome = await execute(context, request.command);
      const eventId = generateId("pae");
      const receipt = await buildReceipt(ctx, eventId, request.operationId, scope, outcome, before);
      const after = await captureState(markupAwareReader(ctx, sessionId), {
        rowIds: [...new Set([...receipt.rows.map((row) => row.id), ...outcome.createdRowIds])],
        geometryIds: [...new Set([...scope.geometryIds, ...outcome.createdGeometryIds])],
        sheetIds: scope.sheetIds,
        markupIds: scope.markupIds,
      });

      const beforePayload: OperationAuditBefore = { schemaVersion: 1, state: before };
      const afterPayload: OperationAuditAfter = {
        schemaVersion: 1,
        state: after,
        requestFingerprint: fingerprint,
        receipt,
      };
      assertAuditPayloadWithinCap(
        beforePayload as unknown as Record<string, unknown>,
        afterPayload as unknown as Record<string, unknown>,
      );
      await ctx.editor.insertOperationAudit({
        id: eventId,
        session_id: sessionId,
        row_id: receipt.rows[0]?.id ?? null,
        actor,
        action: outcome.action,
        before: beforePayload as unknown as Record<string, unknown>,
        after: afterPayload as unknown as Record<string, unknown>,
        operation_id: request.operationId,
        reverses_event_id: null,
      });
      return receipt;
    });
  }

  return {
    async apply(
      sessionId: string,
      request: EditorOperationRequest,
      actor: string,
      grants: EditorGrants,
    ): Promise<OperationReceipt> {
      assertGrants(request.command, request.verify === true, grants);
      const fingerprint = requestFingerprint(request);
      try {
        return await attempt(sessionId, request, actor, fingerprint);
      } catch (error) {
        // Last-line defence. The in-lock lookup catches every retry the lock
        // serialises; this covers the unique index firing anyway. The transaction
        // has already rolled back, so re-read the COMMITTED event and answer from
        // it — but only if it is the same request. No other error is a replay.
        if (!isUniqueViolation(error)) throw error;
        const committed = await committedOperation(sessionId, actor, request.operationId);
        if (!committed) throw error;
        return replayOf(committed, fingerprint);
      }
    },
  };
}

export function editorOperationService(db: Knex, publish: PublishFn) {
  const audits = preconAuditRepository(db);
  return editorOperationServiceWith(createOperationUnitOfWork(db, publish), (sessionId, actor, operationId) =>
    audits.auditEventByOperation(sessionId, actor, operationId),
  );
}
