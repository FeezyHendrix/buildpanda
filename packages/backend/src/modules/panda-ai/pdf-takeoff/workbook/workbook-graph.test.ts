import assert from "node:assert/strict";
import { test } from "node:test";
import { assertAcyclic, findFormulaCycles, type DependencyNode } from "./cycle-graph.ts";
import { isWorkbookRejection } from "./engine-errors.ts";
import { BoundedJobQueue } from "./engine-queue.ts";

// The cycle gate and the queue, on their own.
//
// The engine suite proves both against a real Univer worker, which is the part
// that matters — but it cannot reach the graph's own bounds without building a
// workbook large enough to be slow, and it cannot hold a queue slot open at an
// exact moment. These are the same two mechanisms, driven directly.

const LIMITS = { maxGraphNodes: 1000, maxGraphEdges: 5000, maxReportedCycles: 10 };

function node(treeId: number, children: number[], row = treeId, column = 0): DependencyNode {
  return { treeId, children, subUnitId: "s1", row, column };
}

test("an acyclic graph reports no cycles", () => {
  const chain = [node(1, [2]), node(2, [3]), node(3, [])];
  assert.deepEqual([...findFormulaCycles(chain, LIMITS)], []);

  const diamond = [node(1, [2, 3]), node(2, [4]), node(3, [4]), node(4, [])];
  assert.deepEqual([...findFormulaCycles(diamond, LIMITS)], []);
});

test("a node reachable by two paths is not a cycle", () => {
  // The classic false positive: revisiting a finished node looks like a revisit.
  const shared = [node(1, [2, 3]), node(2, [4]), node(3, [4]), node(4, [5]), node(5, [])];
  assert.deepEqual([...findFormulaCycles(shared, LIMITS)], []);
});

test("self, mutual and long cycles are each found once", () => {
  assert.equal(findFormulaCycles([node(1, [1])], LIMITS).length, 1, "a cell referencing itself");
  assert.equal(findFormulaCycles([node(1, [2]), node(2, [1])], LIMITS).length, 1, "two cells referencing each other");

  const long = [node(1, [2]), node(2, [3]), node(3, [4]), node(4, [2])];
  const cycles = findFormulaCycles(long, LIMITS);
  assert.equal(cycles.length, 1, "one loop, reported once");
  assert.match(cycles[0] ?? "", /s1!r2c0 -> s1!r3c0 -> s1!r4c0 -> s1!r2c0/, "named by cell, start to start");
});

test("the same loop entered from several roots is reported once, not once per root", () => {
  const manyRoots = [node(1, [3]), node(2, [3]), node(3, [4]), node(4, [3])];
  assert.equal(findFormulaCycles(manyRoots, LIMITS).length, 1);
});

test("a deep chain is walked iteratively, not recursed into a stack overflow", () => {
  // A column where each row references the one above is an ordinary takeoff
  // shape, and it is exactly the shape a recursive gate dies on.
  const deep: DependencyNode[] = [];
  for (let i = 1; i <= 50_000; i++) deep.push(node(i, i < 50_000 ? [i + 1] : []));
  const limits = { maxGraphNodes: 100_000, maxGraphEdges: 200_000, maxReportedCycles: 10 };
  assert.deepEqual([...findFormulaCycles(deep, limits)], [], "50000 deep, no cycle, no crash");

  deep[deep.length - 1] = node(50_000, [1]);
  assert.equal(findFormulaCycles(deep, limits).length, 1, "and the loop that closes it is still found");
});

test("a graph bigger than the gate will walk is refused, not partly checked", () => {
  const nodes = [node(1, [2]), node(2, [])];
  try {
    findFormulaCycles(nodes, { maxGraphNodes: 1, maxGraphEdges: 5000, maxReportedCycles: 10 });
    assert.fail("expected an over-large graph to be refused");
  } catch (error) {
    assert.ok(isWorkbookRejection(error, "too_large"));
    assert.equal(error.statusCode, 413);
  }

  const wide = [node(1, [2, 3, 4]), node(2, []), node(3, []), node(4, [])];
  assert.ok(
    isWorkbookRejection(
      (() => {
        try {
          findFormulaCycles(wide, { maxGraphNodes: 1000, maxGraphEdges: 2, maxReportedCycles: 10 });
          return null;
        } catch (error) {
          return error;
        }
      })(),
      "too_large",
    ),
    "the edge budget is enforced too",
  );
});

test("only the first maxReportedCycles loops are named, and the rest are counted", () => {
  const nodes: DependencyNode[] = [];
  for (let i = 0; i < 12; i++) nodes.push(node(i + 1, [i + 1]));
  try {
    assertAcyclic(nodes, { maxGraphNodes: 1000, maxGraphEdges: 5000, maxReportedCycles: 3 });
    assert.fail("expected a cyclic graph to be refused");
  } catch (error) {
    assert.ok(isWorkbookRejection(error, "cyclic_formula"));
    assert.equal(error.cycles.length, 3, "three named");
    assert.match(error.message, /12 circular references/, "twelve counted");
    assert.match(error.message, /\+9 more/);
  }
});

test("assertAcyclic passes a clean graph through silently", () => {
  assert.doesNotThrow(() => assertAcyclic([node(1, [2]), node(2, [])], LIMITS));
});

// ---------- the bounded queue ----------

/** A task that will not finish until the test says so. */
function gate(): { task: () => Promise<string>; release: () => void } {
  let release = (): void => {};
  const started = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { task: async () => { await started; return "done"; }, release };
}

test("the queue runs up to its concurrency and makes the rest wait", async () => {
  const queue = new BoundedJobQueue({ concurrency: 2, maxQueued: 2 });
  const a = gate();
  const b = gate();
  const c = gate();

  const running = [queue.run(a.task), queue.run(b.task), queue.run(c.task)];
  await Promise.resolve();
  assert.equal(queue.active, 2, "two running");
  assert.equal(queue.queued, 1, "one waiting");

  a.release();
  b.release();
  c.release();
  assert.deepEqual(await Promise.all(running), ["done", "done", "done"]);
  assert.equal(queue.active, 0);
  assert.equal(queue.queued, 0);
});

test("a full queue refuses the next caller instead of growing", async () => {
  const queue = new BoundedJobQueue({ concurrency: 1, maxQueued: 2 });
  const held = gate();
  const accepted = [queue.run(held.task), queue.run(held.task), queue.run(held.task)];
  await Promise.resolve();
  assert.equal(queue.capacity, 3);

  await assert.rejects(queue.run(held.task), (error: unknown) => {
    assert.ok(isWorkbookRejection(error, "busy"));
    assert.equal(error.statusCode, 429);
    return true;
  });

  held.release();
  await Promise.all(accepted);
  assert.equal(queue.active, 0, "the refusal cost no slot");
});

test("a slot is released when its task throws, not just when it succeeds", async () => {
  const queue = new BoundedJobQueue({ concurrency: 1, maxQueued: 0 });
  await assert.rejects(
    queue.run(async () => {
      throw new Error("engine fell over");
    }),
    /engine fell over/,
  );
  assert.equal(queue.active, 0, "a failed job does not hold the one slot for ever");
  assert.equal(await queue.run(async () => "next"), "next");
});

test("waiting callers are served in the order they arrived", async () => {
  const queue = new BoundedJobQueue({ concurrency: 1, maxQueued: 4 });
  const order: number[] = [];
  const held = gate();
  const first = queue.run(held.task);
  const rest = [1, 2, 3].map((n) =>
    queue.run(async () => {
      order.push(n);
      return n;
    }),
  );

  held.release();
  await first;
  await Promise.all(rest);
  assert.deepEqual(order, [1, 2, 3], "first in, first out");
});

test("the queue refuses a nonsensical configuration outright", () => {
  assert.throws(() => new BoundedJobQueue({ concurrency: 0, maxQueued: 1 }), RangeError);
  assert.throws(() => new BoundedJobQueue({ concurrency: 1, maxQueued: -1 }), RangeError);
});
