// Does a client hanging up actually stop the calculation — and, just as
// importantly, does a healthy request survive?
//
// This needs a REAL socket. `app.inject()` never opens one, so it cannot tell
// a disconnect from a completed response, and the bug this suite exists to
// catch lives exactly there: an earlier version listened for `close` on the
// REQUEST, which on Node 16+ fires when the request BODY is complete. For a
// POST that is before the handler finishes — so the signal either aborted every
// healthy save, or (because Fastify had already consumed the body and `close`
// had fired) never aborted anything at all. Both look fine to `inject`.
//
// So: a real server on an ephemeral port, a real `fetch`, a real hang-up.
// Ports are ephemeral and the server is torn down per test, so two checkouts
// running this at once cannot collide.

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import Fastify, { type FastifyInstance } from "fastify";
import { abortOnDisconnect } from "./routes.ts";
import { evaluateWorkbook } from "./engine.ts";
import { isWorkbookRejection } from "./engine-errors.ts";
import { liveWorkerCount, onWorkerLifecycle } from "./worker-client.ts";
import { pricedRowsCandidate } from "./workbook-fixtures.ts";

interface Observed {
  aborted: boolean;
  rejectionReason: string | null;
  finished: boolean;
  /** The request stream's state at the moment the signal was attached. */
  requestDestroyedAtAttach: boolean;
  requestCompleteAtAttach: boolean;
}

let app: FastifyInstance;
let origin = "";
let observed: Observed;

/** Wait for a condition, polling. Never a bare sleep: a fixed delay is a flake. */
async function until(predicate: () => boolean, budgetMs = 10_000): Promise<boolean> {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return predicate();
}

before(async () => {
  app = Fastify({ logger: false });

  // The 1000-row fixture takes long enough to be hung up on mid-calculation.
  app.post("/calc", async (request, reply) => {
    observed = {
      aborted: false,
      rejectionReason: null,
      finished: false,
      requestDestroyedAtAttach: false,
      requestCompleteAtAttach: false,
    };
    // The real routes authorise before they calculate. Those awaits are enough
    // for a fully-read request stream to have been destroyed — which is exactly
    // the moment a naive "is the request destroyed?" test misreads a perfectly
    // healthy POST as a hang-up. Reproduced here so this suite can catch it.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setTimeout(resolve, 5));
    observed.requestDestroyedAtAttach = request.raw.destroyed;
    observed.requestCompleteAtAttach = request.raw.complete;
    const disconnect = abortOnDisconnect(request, reply);
    disconnect.signal.addEventListener("abort", () => {
      observed.aborted = true;
    });
    try {
      const result = await evaluateWorkbook(pricedRowsCandidate(`wb-cancel-${Date.now()}`), {
        signal: disconnect.signal,
      });
      observed.finished = true;
      return { populatedCells: result.populatedCells };
    } catch (error) {
      observed.rejectionReason = isWorkbookRejection(error) ? error.reason : `unexpected: ${String(error)}`;
      throw error;
    } finally {
      disconnect.done();
    }
  });

  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  assert.ok(address && typeof address === "object");
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await app.close();
});

describe("a healthy request is never mistaken for a disconnect", () => {
  test("a normal POST with a body completes, and its signal never aborts", async () => {
    const response = await fetch(`${origin}/calc`, {
      method: "POST",
      headers: { "content-type": "application/json", connection: "keep-alive" },
      body: JSON.stringify({ hello: "world" }),
    });

    assert.equal(response.status, 200, "a healthy save must not be cancelled by its own request body");
    const body = (await response.json()) as { populatedCells: number };
    assert.ok(body.populatedCells > 0);
    assert.equal(observed.finished, true);
    assert.equal(observed.aborted, false, "the abort signal must stay unfired for a request nobody cancelled");
    assert.equal(observed.rejectionReason, null, "a normal POST must never answer 499");
    assert.equal(observed.requestCompleteAtAttach, true, "the body had been fully read by then");
    assert.equal(
      observed.requestDestroyedAtAttach,
      true,
      "and the request stream had been destroyed — a destroyed COMPLETE request is not a disconnect",
    );
  });

  test("a second POST on the same keep-alive connection behaves identically", async () => {
    const response = await fetch(`${origin}/calc`, {
      method: "POST",
      headers: { "content-type": "application/json", connection: "keep-alive" },
      body: JSON.stringify({ again: true }),
    });
    assert.equal(response.status, 200);
    assert.equal(observed.aborted, false);
  });
});

describe("a client that hangs up stops the calculation", () => {
  test("the signal fires, the job is refused as aborted, and the worker thread actually exits", async () => {
    const exits: number[] = [];
    const stop = onWorkerLifecycle((event, threadId) => {
      if (event === "exit") exits.push(threadId);
    });

    try {
      const controller = new AbortController();
      const inFlight = fetch(`${origin}/calc`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ big: true }),
        signal: controller.signal,
      });

      // Hang up once the worker is genuinely running, not before.
      await until(() => liveWorkerCount() > 0, 15_000);
      assert.ok(liveWorkerCount() > 0, "the calculation was under way when the client left");
      controller.abort();
      await assert.rejects(inFlight, /abort/i);

      assert.ok(await until(() => observed.aborted, 10_000), "the disconnect reached the calculation");
      assert.ok(
        await until(() => observed.rejectionReason !== null, 10_000),
        "the job was refused rather than quietly finishing",
      );
      assert.equal(observed.rejectionReason, "aborted");
      assert.equal(observed.finished, false, "no result was published for a caller who left");

      assert.ok(await until(() => liveWorkerCount() === 0, 15_000), "the worker thread was terminated, not leaked");
      assert.ok(exits.length > 0, "the thread reported its own exit");
    } finally {
      stop();
    }
  });

  test("the server is still healthy afterwards, so a cancellation leaks no slot", async () => {
    const response = await fetch(`${origin}/calc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ after: "cancel" }),
    });
    assert.equal(response.status, 200, "the concurrency slot was released by the cancelled job");
    assert.equal(observed.aborted, false);
    assert.equal(liveWorkerCount(), 0);
  });
});
