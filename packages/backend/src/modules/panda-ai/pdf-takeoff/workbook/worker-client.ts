// Spawning, bounding and reliably killing one calculation worker.
//
// A worker per job, never a pool: the spike showed correct results from fresh
// module contexts and offered no evidence that a reused engine stays clean, so
// reuse would be a guess dressed as an optimisation.
//
// Every exit path — answered, timed out, aborted, crashed — runs through one
// `settle` that clears the timer, drops the abort listener and terminates the
// thread. That is the whole reason the function is written this way: a caller
// hanging up must not leave an engine holding ~150 MiB for the next 15 seconds.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { fromRejectionWire, WorkbookRejectedError } from "./engine-errors.ts";
import { WORKBOOK_TERMINATE_GRACE_MS } from "./engine-limits.ts";
import type { WorkbookJob, WorkbookJobSuccess, WorkbookWorkerMessage } from "./engine-types.ts";

/**
 * Where the worker entry lives, in the two ways this code is ever executed.
 *
 * Under tsx this module IS `worker-client.ts` on disk, so the entry is its
 * sibling source file. Built, tsup has bundled this module into `dist/` and
 * emitted the worker as its own flat entry beside it (see `tsup.config.ts`),
 * so the same sibling name resolves with a `.js` extension. The extension of
 * this module's own URL is therefore the whole decision — there is no build
 * flag, no environment variable and no generated code involved.
 */
export function workerEntryUrl(): URL {
  const self = import.meta.url;
  return new URL(self.endsWith(".ts") ? "./worker-entry.ts" : "./worker-entry.js", self);
}

export type WorkerLifecycleEvent = "spawn" | "exit";

const liveThreads = new Set<number>();
const lifecycleListeners = new Set<(event: WorkerLifecycleEvent, threadId: number) => void>();

/**
 * Threads that have started and not yet emitted `exit`.
 *
 * Counted from the thread's own `exit` event, never from a `terminate()` call
 * returning: asking for a thread to stop is not the same as it having stopped,
 * and the difference is exactly what the concurrency bound is protecting.
 */
export function liveWorkerCount(): number {
  return liveThreads.size;
}

export function onWorkerLifecycle(
  listener: (event: WorkerLifecycleEvent, threadId: number) => void,
): () => void {
  lifecycleListeners.add(listener);
  return () => {
    lifecycleListeners.delete(listener);
  };
}

function emitLifecycle(event: WorkerLifecycleEvent, threadId: number): void {
  for (const listener of lifecycleListeners) listener(event, threadId);
}

function isWorkerMessage(value: unknown): value is WorkbookWorkerMessage {
  if (typeof value !== "object" || value === null) return false;
  const ok: unknown = (value as { ok?: unknown }).ok;
  if (ok === true) return "result" in value;
  if (ok === false) return "rejection" in value;
  return false;
}

export interface RunWorkbookJobOptions {
  readonly deadlineMs: number;
  readonly signal?: AbortSignal;
}

type Outcome =
  | { readonly kind: "ok"; readonly result: WorkbookJobSuccess }
  | { readonly kind: "error"; readonly error: WorkbookRejectedError };

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function abandoned(): WorkbookRejectedError {
  return new WorkbookRejectedError("aborted", "workbook calculation was abandoned by its caller");
}

/**
 * Ask the thread to stop, then wait for it to actually stop.
 *
 * `terminate()` resolving is a request being accepted, not a thread being gone,
 * so the worker's own `exit` event is awaited as well. The grace window is what
 * stops a wedged thread from hanging the caller for ever; blowing through it
 * throws, and the caller is told the truth rather than a clean finish.
 */
async function stopThread(worker: Worker, exited: Promise<void>, graceMs: number): Promise<void> {
  let graceTimer: NodeJS.Timeout | undefined;
  const expired = new Promise<never>((_, rejectGrace) => {
    graceTimer = setTimeout(
      () => rejectGrace(new Error(`thread did not exit within ${graceMs}ms of being terminated`)),
      graceMs,
    );
  });
  try {
    await Promise.race([Promise.all([worker.terminate(), exited]), expired]);
  } finally {
    // Clearing the timer also stops `expired` ever rejecting once the race is
    // won, so the losing branch cannot become an unhandled rejection.
    if (graceTimer !== undefined) clearTimeout(graceTimer);
  }
}

export function runWorkbookJob(job: WorkbookJob, options: RunWorkbookJobOptions): Promise<WorkbookJobSuccess> {
  // Checked before a thread exists, so a caller who has already given up costs
  // nothing at all. This is also the only abort that could otherwise be missed:
  // `addEventListener` on an already-aborted signal never fires. Once past this
  // line the listener is registered in the same synchronous block as the spawn,
  // and no other task can run in between, so no abort can fall through the gap.
  if (options.signal?.aborted === true) return Promise.reject(abandoned());

  const entry = workerEntryUrl();
  if (!existsSync(fileURLToPath(entry))) {
    // A build that forgot the worker entry would otherwise surface as an opaque
    // module-resolution failure inside a thread, long after deployment.
    return Promise.reject(
      new WorkbookRejectedError(
        "engine_failure",
        `workbook worker entry is missing at ${entry.href}. The build must emit it as its own entry; ` +
          "a deployment cannot fall back to TypeScript source.",
      ),
    );
  }

  return new Promise<WorkbookJobSuccess>((resolve, reject) => {
    const worker = new Worker(entry, { workerData: job });
    const threadId = worker.threadId;
    liveThreads.add(threadId);
    emitLifecycle("spawn", threadId);

    const exited = new Promise<void>((resolveExit) => {
      worker.once("exit", () => {
        if (liveThreads.delete(threadId)) emitLifecycle("exit", threadId);
        resolveExit();
      });
    });

    let done = false;

    const teardown = async (outcome: Outcome): Promise<void> => {
      try {
        await stopThread(worker, exited, WORKBOOK_TERMINATE_GRACE_MS);
      } catch (cause) {
        // Never report a clean finish that did not happen. A thread we could
        // not stop is still holding an engine, so the concurrency bound no
        // longer means anything and the caller has to hear about it.
        reject(
          new WorkbookRejectedError(
            "engine_failure",
            `workbook worker thread ${threadId} could not be stopped (${describe(cause)}); it may still be ` +
              `running${outcome.kind === "error" ? `, after ${outcome.error.reason}` : ""}.`,
          ),
        );
        return;
      }
      if (outcome.kind === "ok") resolve(outcome.result);
      else reject(outcome.error);
    };

    // The caller is answered only after the thread is gone, so the queue slot
    // this job holds is released against a dead thread rather than a pending
    // terminate(). That is what makes the concurrency bound count threads.
    const settle = (outcome: Outcome): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      teardown(outcome).catch((cause: unknown) => {
        reject(
          new WorkbookRejectedError("engine_failure", `workbook worker teardown failed: ${describe(cause)}`),
        );
      });
    };

    const fail = (error: WorkbookRejectedError): void => settle({ kind: "error", error });

    const timer = setTimeout(() => {
      fail(
        new WorkbookRejectedError(
          "timeout",
          `workbook calculation exceeded its ${options.deadlineMs}ms deadline; the worker was terminated and ` +
            "no value was published.",
        ),
      );
    }, options.deadlineMs);

    const onAbort = (): void => fail(abandoned());
    options.signal?.addEventListener("abort", onAbort, { once: true });

    worker.on("message", (raw: unknown) => {
      if (!isWorkerMessage(raw)) {
        fail(new WorkbookRejectedError("engine_failure", "workbook worker sent an unreadable message"));
        return;
      }
      if (raw.ok) settle({ kind: "ok", result: raw.result });
      else fail(fromRejectionWire(raw.rejection));
    });

    worker.on("error", (error: Error) => {
      fail(new WorkbookRejectedError("engine_failure", `workbook worker failed: ${error.message}`));
    });

    worker.on("exit", (code: number) => {
      fail(new WorkbookRejectedError("engine_failure", `workbook worker exited with code ${code} before answering`));
    });
  });
}
