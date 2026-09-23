import assert from "node:assert/strict";
import { test } from "node:test";
import {
  duplicateIndices,
  emptyReview,
  keptWithManual,
  requestGuard,
  stepCurrent,
  toggleDropped,
  toggleManualAt,
  type SymbolReview,
} from "./detection-model.ts";

const P = [
  [10, 10],
  [20, 10],
  [30, 10],
];

function review(overrides: Partial<SymbolReview> = {}): SymbolReview {
  return { ...emptyReview("Door", P), ...overrides };
}

test("kept points exclude dropped detections and include manual additions", () => {
  const r = review({ dropped: new Set([1]), manual: [[50, 50]] });
  assert.deepEqual(keptWithManual(r), [
    [10, 10],
    [30, 10],
    [50, 50],
  ]);
});

test("reject-all drops every detection but keeps manual markers", () => {
  const r = review({ dropped: new Set([0, 1, 2]), manual: [[50, 50]] });
  assert.deepEqual(keptWithManual(r), [[50, 50]]);
});

test("toggleDropped flips one detection", () => {
  const r = toggleDropped(review(), 2);
  assert.equal(r.dropped.has(2), true);
  assert.equal(toggleDropped(r, 2).dropped.has(2), false);
});

test("toggleManualAt adds a marker, and clicking an existing one removes it", () => {
  const r1 = toggleManualAt(review(), [50, 50], 2);
  assert.deepEqual(r1.manual, [[50, 50]]);
  const r2 = toggleManualAt(r1, [51, 50], 2);
  assert.deepEqual(r2.manual, []);
});

test("stepCurrent cycles forward and backward over the detections", () => {
  assert.equal(stepCurrent(review({ current: 2 }), 1).current, 0);
  assert.equal(stepCurrent(review({ current: 0 }), -1).current, 2);
});

test("duplicateIndices flags combined points sitting on existing counted markers", () => {
  const combined = [
    [10, 10],
    [200, 200],
    [30.5, 10.5],
  ];
  const existing = [
    [10, 10],
    [30, 10],
  ];
  assert.deepEqual([...duplicateIndices(combined, existing, 2)], [0, 2]);
  assert.deepEqual([...duplicateIndices(combined, existing, 0.1)], [0]);
});

test("requestGuard accepts only the response bound to the live request", () => {
  const guard = requestGuard();
  const first = guard.begin("sheet-1", "room_fill");
  assert.equal(guard.isLive(first), true);
  const second = guard.begin("sheet-1", "room_fill");
  assert.equal(guard.isLive(first), false, "a newer request supersedes the old one");
  assert.equal(guard.isLive(second), true);
  guard.invalidate();
  assert.equal(guard.isLive(second), false, "sheet or tool change invalidates in-flight work");
});
