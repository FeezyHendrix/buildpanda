import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkbookEngine } from "./engine.ts";
import { isWorkbookRejection, type WorkbookRejectionReason } from "./engine-errors.ts";
import { liveWorkerCount, onWorkerLifecycle, type WorkerLifecycleEvent } from "./worker-client.ts";
import { takeoffCandidate } from "./workbook-fixtures.ts";

// Worker lifecycle, measured by the threads themselves.
//
// `queue.active === 0` proves only that a promise settled. It says nothing
// about whether the thread that promise owned is still holding ~150 MiB, and
// the concurrency bound exists to limit threads, not promises. So every
// assertion here reads `onWorkerLifecycle`/`liveWorkerCount`, which count the
// worker's own `exit` event — a `terminate()` call returning is a request, not
// a death certificate.

/** Let queued microtasks and one turn of the event loop run. */
function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

async function reasonOf(run: () => Promise<unknown>): Promise<WorkbookRejectionReason | null> {
  try {
    await run();
    return null;
  } catch (error) {
    if (!isWorkbookRejection(error)) throw error;
    return error.reason;
  }
}

interface Recorder {
  readonly events: WorkerLifecycleEvent[];
  readonly spawns: () => number;
  /** Highest number of threads alive at once. */
  readonly peakLive: () => number;
  readonly stop: () => void;
}

function record(): Recorder {
  const events: WorkerLifecycleEvent[] = [];
  let live = 0;
  let peak = 0;
  const stop = onWorkerLifecycle((event) => {
    events.push(event);
    live += event === "spawn" ? 1 : -1;
    peak = Math.max(peak, live);
  });
  return {
    events,
    spawns: () => events.filter((event) => event === "spawn").length,
    peakLive: () => peak,
    stop,
  };
}

test("a settled calculation has already buried its thread", async () => {
  const engine = createWorkbookEngine();
  const recorder = record();
  try {
    await engine.evaluateWorkbook(takeoffCandidate(24));
    assert.equal(
      liveWorkerCount(),
      0,
      "the promise resolved while its thread was still alive: terminate() was not awaited",
    );
    assert.deepEqual(recorder.events, ["spawn", "exit"], "the exit was observed before the caller was answered");
  } finally {
    recorder.stop();
  }
});

test("concurrency 1 means one LIVE thread, not one in-flight promise", async () => {
  // The defect this pins: releasing the queue slot as soon as terminate() was
  // *requested* lets the next job spawn while the previous thread is still
  // running, so the real thread count silently exceeds the configured bound.
  const engine = createWorkbookEngine({ concurrency: 1, maxQueued: 4 });
  const recorder = record();
  try {
    await Promise.all([
      engine.evaluateWorkbook(takeoffCandidate(24, "wb-serial-a")),
      engine.evaluateWorkbook(takeoffCandidate(28, "wb-serial-b")),
      engine.evaluateWorkbook(takeoffCandidate(40, "wb-serial-c")),
    ]);

    assert.equal(recorder.spawns(), 3, "three jobs, three threads");
    assert.equal(recorder.peakLive(), 1, "never more than one thread alive at a time");
    assert.deepEqual(
      recorder.events,
      ["spawn", "exit", "spawn", "exit", "spawn", "exit"],
      "each thread is gone before the next one starts",
    );
    assert.equal(liveWorkerCount(), 0);
  } finally {
    recorder.stop();
  }
});

test("a caller who gives up while queued never gets a thread at all", async () => {
  // The defect this pins: the abort was checked once, before queueing, and the
  // abort listener was only attached after the worker was spawned. A signal
  // that fired in between was therefore never seen — the abandoned job waited
  // its turn, spawned a thread, and ran to completion.
  const engine = createWorkbookEngine({ concurrency: 1, maxQueued: 4 });
  const recorder = record();
  try {
    const blocker = engine.evaluateWorkbook(takeoffCandidate(24, "wb-blocker"));
    const controller = new AbortController();
    const queued = engine.evaluateWorkbook(takeoffCandidate(28, "wb-queued"), { signal: controller.signal });

    await tick();
    assert.equal(engine.queued, 1, "the second job is waiting for the slot");
    assert.equal(recorder.spawns(), 1, "and has not been given a thread yet");

    controller.abort();
    assert.equal(await reasonOf(() => queued), "aborted", "an abandoned queued job must not be run");

    await blocker;
    assert.equal(recorder.spawns(), 1, "only the blocker ever spawned a thread");
    assert.equal(liveWorkerCount(), 0);
  } finally {
    recorder.stop();
  }
});

test("a caller who gave up before asking never gets a thread either", async () => {
  const engine = createWorkbookEngine();
  const recorder = record();
  try {
    const controller = new AbortController();
    controller.abort();
    assert.equal(
      await reasonOf(() => engine.evaluateWorkbook(takeoffCandidate(24), { signal: controller.signal })),
      "aborted",
    );
    assert.equal(recorder.spawns(), 0, "an already-abandoned caller spawns nothing");
  } finally {
    recorder.stop();
  }
});

test("an abort mid-calculation is not answered until the thread is gone", async () => {
  const engine = createWorkbookEngine();
  const recorder = record();
  try {
    const controller = new AbortController();
    const inFlight = engine.evaluateWorkbook(takeoffCandidate(24), { signal: controller.signal });
    setTimeout(() => controller.abort(), 30);

    assert.equal(await reasonOf(() => inFlight), "aborted");
    assert.equal(liveWorkerCount(), 0, "the caller was told it was cancelled while the thread still ran");
    assert.deepEqual(recorder.events, ["spawn", "exit"]);
    assert.equal(engine.active, 0);
  } finally {
    recorder.stop();
  }
});

test("a deadline is not reported until the thread it killed has exited", async () => {
  const engine = createWorkbookEngine({ deadlineMs: 1 });
  const recorder = record();
  try {
    assert.equal(await reasonOf(() => engine.evaluateWorkbook(takeoffCandidate(24))), "timeout");
    assert.equal(liveWorkerCount(), 0, "a timeout that leaves the thread running has not reclaimed anything");
    assert.deepEqual(recorder.events, ["spawn", "exit"]);
  } finally {
    recorder.stop();
  }
});

test("a job queued behind a timing-out job still waits for that thread to die", async () => {
  const engine = createWorkbookEngine({ concurrency: 1, maxQueued: 4, deadlineMs: 120 });
  const recorder = record();
  try {
    const timingOut = engine.evaluateWorkbook(takeoffCandidate(24, "wb-slow"));
    const behind = engine.evaluateWorkbook(takeoffCandidate(28, "wb-behind"));

    assert.equal(await reasonOf(() => timingOut), "timeout");
    await behind.catch(() => undefined);

    assert.equal(recorder.peakLive(), 1, "the queued job did not start beside the thread being killed");
    assert.equal(liveWorkerCount(), 0);
  } finally {
    recorder.stop();
  }
});
