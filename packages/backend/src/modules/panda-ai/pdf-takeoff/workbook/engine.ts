// The workbook calculation service: the one entry point the rest of BuildPanda
// calls, and the only order these steps are allowed to happen in.
//
//   validate  ->  queue  ->  worker  ->  settle  ->  cycle gate  ->  read
//
// Validation runs OUTSIDE the queue on purpose. A malformed or over-large
// candidate is the cheapest thing to refuse, and making it wait behind a real
// calculation — or spend the one concurrency slot — would let a bad client
// deny service with documents that were never going to be calculated.
//
// Nothing here touches the database, and no worker runs while a transaction
// lock is held, because nothing in this module opens one. Contract 6 puts the
// coherent read and the lock either side of this call, not inside it.

import { randomUUID } from "node:crypto";
import { assertAcyclic } from "./cycle-graph.ts";
import { rejectWorkbook } from "./engine-errors.ts";
import {
  resolveLimits,
  WORKBOOK_CONCURRENCY,
  WORKBOOK_DEADLINE_MS,
  WORKBOOK_QUEUE_DEPTH,
  type WorkbookLimits,
} from "./engine-limits.ts";
import { BoundedJobQueue } from "./engine-queue.ts";
import type { EvaluateWorkbookResult, WorkbookJob } from "./engine-types.ts";
import { validateWorkbookSnapshot } from "./engine-validation.ts";
import { runWorkbookJob } from "./worker-client.ts";

export interface EvaluateWorkbookOptions {
  /** Abort when the caller goes away. The worker is terminated, not left running. */
  readonly signal?: AbortSignal;
  readonly deadlineMs?: number;
  /** Supplied by the caller when the job should be traceable to an operation. */
  readonly jobId?: string;
}

export interface WorkbookEngineConfig {
  readonly concurrency?: number;
  readonly maxQueued?: number;
  readonly deadlineMs?: number;
  readonly limits?: Partial<WorkbookLimits>;
}

export interface WorkbookEngine {
  evaluateWorkbook(snapshot: unknown, options?: EvaluateWorkbookOptions): Promise<EvaluateWorkbookResult>;
  readonly active: number;
  readonly queued: number;
  readonly limits: WorkbookLimits;
}

export function createWorkbookEngine(config: WorkbookEngineConfig = {}): WorkbookEngine {
  const limits = resolveLimits(config.limits);
  const defaultDeadlineMs = config.deadlineMs ?? WORKBOOK_DEADLINE_MS;
  const queue = new BoundedJobQueue({
    concurrency: config.concurrency ?? WORKBOOK_CONCURRENCY,
    maxQueued: config.maxQueued ?? WORKBOOK_QUEUE_DEPTH,
  });

  return {
    limits,
    get active(): number {
      return queue.active;
    },
    get queued(): number {
      return queue.queued;
    },

    async evaluateWorkbook(input, options = {}): Promise<EvaluateWorkbookResult> {
      const snapshot = validateWorkbookSnapshot(input, limits);
      if (options.signal?.aborted === true) {
        rejectWorkbook("aborted", "workbook calculation was abandoned before it started");
      }

      const deadlineMs = options.deadlineMs ?? defaultDeadlineMs;
      const job: WorkbookJob = {
        jobId: options.jobId ?? randomUUID(),
        snapshot,
        settleTimeoutMs: deadlineMs,
        maxGraphNodes: limits.maxGraphNodes,
        maxGraphEdges: limits.maxGraphEdges,
        maxReportedCycles: limits.maxReportedCycles,
      };

      const outcome = await queue.run(async () => {
        // Re-checked here, inside the slot, and not only before queueing. A
        // caller can give up while its job waits its turn, and starting an
        // abandoned job would spend a worker on an answer nobody will read.
        if (options.signal?.aborted === true) {
          rejectWorkbook("aborted", "workbook calculation was abandoned while it waited for a calculation slot");
        }
        const startedAt = performance.now();
        const value = await runWorkbookJob(job, { deadlineMs, signal: options.signal });
        return { value, durationMs: performance.now() - startedAt };
      });

      return Object.freeze({
        snapshot,
        values: outcome.value.values,
        errors: outcome.value.errors,
        populatedCells: outcome.value.populatedCells,
        durationMs: Number(outcome.durationMs.toFixed(1)),
      });
    },
  };
}

const defaultEngine = createWorkbookEngine();

/**
 * Calculate a candidate workbook with the process-wide bounds.
 *
 * Returns the validated candidate, the current value of every populated cell,
 * and every cell whose formula did not produce a usable figure. It rejects with
 * a `WorkbookRejectedError` — never with a partial result, and never with a
 * value standing in for an error.
 */
export function evaluateWorkbook(
  snapshot: unknown,
  options?: EvaluateWorkbookOptions,
): Promise<EvaluateWorkbookResult> {
  return defaultEngine.evaluateWorkbook(snapshot, options);
}

export { assertAcyclic };
