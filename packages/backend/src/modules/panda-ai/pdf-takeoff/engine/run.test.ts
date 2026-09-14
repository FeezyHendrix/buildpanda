import { test } from "node:test";
import assert from "node:assert/strict";
import { regionShareOfSheet } from "./run.ts";
import type { Segment } from "../types.ts";

function seg(x1: number, y1: number, x2: number, y2: number): Segment {
  return { x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1), width: 0.3, color: "#000" };
}

test("regionShareOfSheet: a region filling the whole sheet reports ~1 (envelope isolation failed -> provisional)", () => {
  const segments = [seg(0, 0, 100, 0), seg(0, 100, 100, 100)];
  const share = regionShareOfSheet({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, segments);
  assert.ok(share >= 0.85, `expected near-full share, got ${share.toFixed(2)}`);
});

test("regionShareOfSheet: a building occupying part of the sheet reports a low share (billable)", () => {
  const segments = [seg(0, 0, 200, 0), seg(0, 200, 200, 200)]; // sheet is 200x200
  const share = regionShareOfSheet({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, segments); // building is 100x100
  assert.ok(share < 0.85, `expected part-share, got ${share.toFixed(2)}`); // 10000/40000 = 0.25
});

test("regionShareOfSheet: a degenerate (zero-area) sheet is treated as fully occupied", () => {
  assert.equal(regionShareOfSheet({ minX: 0, minY: 0, maxX: 0, maxY: 0 }, [seg(0, 0, 0, 0)]), 1);
});
