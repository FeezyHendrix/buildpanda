// Reading a workbook, and saving one.
//
// The order of a save is the entire safety argument, so it is spelled out
// rather than left to be inferred:
//
//    1. validate the document. Cheapest refusal — no lock, no worker.
//    2. answer a retry from its committed record before anything else.
//    3. coherent read of workbook + sources in one READ ONLY transaction.
//    4. early version / fingerprint checks. OPTIMISATIONS ONLY: they save a
//       15-second worker on a save that was never going to commit, and every
//       one of them is repeated authoritatively inside the lock.
//    5. project the row patches, render the trusted grid, and refuse the whole
//       candidate if a generated cell disagrees with the bill.
//    6. calculate, OUTSIDE any lock, with the caller's abort signal.
//    7. hand to `commitWorkbook`, which re-checks everything and writes.
//
// Nothing between 6 and 7 writes and nothing inside 7 calculates, so contract
// 5's "no worker executes while a DB transaction lock is held" holds by
// construction rather than by anybody remembering it.

import type { Knex } from "knex";
import { assertFresh, commitWorkbook, isUniqueViolation, replayReceipt } from "./commit.ts";
import { composeWorkbook, liveRowsById, projectPatchedRows } from "./document.ts";
import { validateWorkbookSnapshot } from "./engine-validation.ts";
import { evaluateWorkbook } from "./engine.ts";
import { saveFingerprint, sourceFingerprint } from "./fingerprint.ts";
import { hydrateWorkbook } from "./hydrate.ts";
import { workbookHistoryService } from "./history.ts";
import { buildGeneratedLayout, withScratchSheets, workbookIdFor } from "./layout.ts";
import { preconWorkbookRepository } from "./repository.ts";
import { sanitizeCandidate } from "./sanitize.ts";
import { readCoherentState, type WorkbookSourceSet } from "./source.ts";
import type { PublishFn } from "../service.ts";
import type { WorkbookSnapshot } from "./engine-types.ts";
import type {
  PreconWorkbookRow,
  WorkbookDocument,
  WorkbookHistoryEntry,
  WorkbookLayout,
  WorkbookRowPatch,
  WorkbookSaveRequest,
  WorkbookSaveResult,
} from "./types.ts";
import type { PreconAuditEventRow, PreconBoqRowRow } from "../types.ts";

export interface RenderedCandidate {
  readonly layout: WorkbookLayout;
  readonly snapshot: WorkbookSnapshot;
  readonly rows: Map<string, PreconBoqRowRow>;
}

/**
 * The document a write WOULD store: the generated block rebuilt from the
 * patched bill, with the user's own cells carried through around it.
 *
 * `user` is trusted here. A candidate off the wire must go through
 * `renderCandidate` instead; the only caller that may use this directly is the
 * undo path, whose input is a document this server itself recorded after it had
 * already been checked.
 */
export function renderTrusted(
  source: WorkbookSourceSet,
  stored: PreconWorkbookRow | undefined,
  user: WorkbookSnapshot | null,
  patches: readonly WorkbookRowPatch[],
  actor: string,
): RenderedCandidate {
  const rows = projectPatchedRows(liveRowsById(source), patches, actor);
  const generated = buildGeneratedLayout(source, stored?.layout);
  const layout = withScratchSheets(
    generated,
    user?.sheetOrder ?? generated.map((sheet) => sheet.sheetId),
    (sheetId) => user?.sheets[sheetId]?.name ?? sheetId,
  );
  const snapshot = hydrateWorkbook({
    workbookId: workbookIdFor(source.sessionId),
    workbookName: user?.name ?? "Takeoff workbook",
    layout,
    rows,
    user,
  });
  return { layout, snapshot, rows };
}

/** The same, plus the gate that refuses the whole candidate if it moved a measured figure. */
export function renderCandidate(
  source: WorkbookSourceSet,
  stored: PreconWorkbookRow | undefined,
  candidate: WorkbookSnapshot,
  patches: readonly WorkbookRowPatch[],
  actor: string,
): RenderedCandidate {
  const rendered = renderTrusted(source, stored, candidate, patches, actor);
  sanitizeCandidate(candidate, rendered.layout, rendered.snapshot);
  return rendered;
}

/**
 * @param publish broadcasts a committed change to the take-off's other readers.
 *   Injected, never imported: the service must not know that a Fastify realtime
 *   hub exists, and a test must be able to watch what it emits without one.
 */
export function workbookService(db: Knex, publish: PublishFn = () => {}) {
  const repo = preconWorkbookRepository(db);
  const history = workbookHistoryService(repo);

  const historyFor = (sessionId: string, actor: string): Promise<readonly WorkbookHistoryEntry[]> =>
    history.history(sessionId, actor).then((result) => result.operations);

  async function readOnce(sessionId: string, actor: string, signal?: AbortSignal): Promise<WorkbookDocument> {
    const { source, stored } = await readCoherentState(db, sessionId);
    const composed = await composeWorkbook({
      source,
      stored,
      user: null,
      rows: liveRowsById(source),
      version: stored?.version ?? 0,
      history: await historyFor(sessionId, actor),
      ...(signal ? { signal } : {}),
    });
    return composed.document;
  }

  /**
   * A retry answered from the first attempt's record: the ORIGINAL receipt,
   * beside a CURRENT document. The two deliberately disagree once something has
   * happened since — freezing the document to match the receipt would hand back
   * a workbook that is no longer true, and recomputing the receipt to match the
   * document would claim the save did something it never did.
   *
   * Publishes nothing. A replay changed no state, so announcing one would make
   * every other tab throw away a good cache for no reason.
   */
  async function replayed(
    event: PreconAuditEventRow,
    requestFingerprint: string,
    sessionId: string,
    actor: string,
  ): Promise<WorkbookSaveResult> {
    const receipt = replayReceipt(event, requestFingerprint);
    return {
      eventId: event.id,
      operationId: receipt.operationId,
      replayed: true,
      receipt,
      document: await readOnce(sessionId, actor),
    };
  }

  return {
    readOnce,
    replayed,
    historyFor,

    /**
     * The workbook as it stands, always recalculated from the live bill.
     *
     * A take-off that has never been saved gets a deterministic version 0 draft
     * — generated here, returned, and NOT written. The first save is what
     * creates version 1, so opening a take-off to look at it leaves no trace and
     * cannot race another reader into creating two workbooks.
     *
     * The read repeats once if the measurements moved while it was calculating,
     * so what comes back was computed from the state it reports rather than from
     * one already superseded when it was sent.
     */
    async read(sessionId: string, actor: string, signal?: AbortSignal): Promise<WorkbookDocument> {
      const first = await readOnce(sessionId, actor, signal);
      const { source } = await readCoherentState(db, sessionId);
      if (sourceFingerprint(source) === first.sourceFingerprint) return first;
      return readOnce(sessionId, actor, signal);
    },

    history: (sessionId: string, actor: string, limit?: number) => history.history(sessionId, actor, limit),

    async save(
      sessionId: string,
      request: WorkbookSaveRequest,
      actor: string,
      signal?: AbortSignal,
    ): Promise<WorkbookSaveResult> {
      const candidate = validateWorkbookSnapshot(request.snapshot);
      const requestFingerprint = saveFingerprint(request, candidate);

      const early = await repo.workbookEventByOperation(sessionId, actor, request.operationId);
      if (early) return replayed(early, requestFingerprint, sessionId, actor);

      const { source, stored } = await readCoherentState(db, sessionId);
      assertFresh(stored, source, request);

      const rendered = renderCandidate(source, stored, candidate, request.rowPatches ?? [], actor);
      const evaluated = await evaluateWorkbook(rendered.snapshot, {
        jobId: request.operationId,
        ...(signal ? { signal } : {}),
      });

      try {
        const outcome = await commitWorkbook(db, {
          sessionId,
          operationId: request.operationId,
          actor,
          expected: request,
          requestFingerprint,
          layout: rendered.layout,
          evaluated,
          rowPatches: request.rowPatches ?? [],
          action: "workbook_edited",
        });
        if (outcome.replayed) return replayed(outcome.event, requestFingerprint, sessionId, actor);
        // After the transaction resolved, and only for a write that landed.
        publish(sessionId, outcome.broadcast);
        return {
          ...outcome.result,
          document: { ...outcome.result.document, history: await historyFor(sessionId, actor) },
        };
      } catch (error) {
        // Last-line defence. The in-lock lookup catches every retry the lock
        // serialises; this covers the unique index firing anyway. The
        // transaction has already rolled back, so answer from the COMMITTED
        // event — but only when it is the same request.
        if (!isUniqueViolation(error)) throw error;
        const raced = await repo.workbookEventByOperation(sessionId, actor, request.operationId);
        if (!raced) throw error;
        return replayed(raced, requestFingerprint, sessionId, actor);
      }
    },
  };
}

export type WorkbookService = ReturnType<typeof workbookService>;
