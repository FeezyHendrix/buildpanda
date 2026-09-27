import assert from "node:assert/strict";
import { test } from "node:test";
import { nextInStack, stackedHitsAt, type StackCycle } from "./stacked-picker.ts";
import type { PreconGeometry } from "@/api/precon";

const geo = (id: string, kind: PreconGeometry["kind"], vertices: number[][]): PreconGeometry =>
  ({ id, rowId: `r-${id}`, sheetId: "s", kind, vertices, source: "manual", quantity: null, unit: null }) as PreconGeometry;

const bigArea = geo("big", "area", [[0, 0], [100, 0], [100, 100], [0, 100]]);
const smallArea = geo("small", "area", [[20, 20], [60, 20], [60, 60], [20, 60]]);
const run = geo("run", "linear", [[0, 40], [100, 40]]);

test("hits find every shape under the point: two areas and the run through it", () => {
  const hits = stackedHitsAt([40, 40], [bigArea, smallArea, run], 5);
  assert.deepEqual(hits.map((g) => g.id), ["big", "small", "run"]);
});

test("a point outside the small area hits only the big one", () => {
  assert.deepEqual(stackedHitsAt([80, 80], [bigArea, smallArea, run], 5).map((g) => g.id), ["big"]);
});

test("repeated clicks at the same spot cycle through the stack and wrap", () => {
  let cycle: StackCycle | null = null;
  const picks: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    const r = nextInStack(cycle, [40, 40], stackedHitsAt([40, 40], [bigArea, smallArea, run], 5), 5);
    picks.push(r!.pick.id);
    cycle = r!.cycle;
  }
  assert.deepEqual(picks, ["big", "small", "run", "big"]);
});

test("a click somewhere else restarts the cycle at the top", () => {
  const first = nextInStack(null, [40, 40], stackedHitsAt([40, 40], [bigArea, smallArea, run], 5), 5)!;
  const moved = nextInStack(first.cycle, [80, 80], stackedHitsAt([80, 80], [bigArea, smallArea, run], 5), 5)!;
  assert.equal(moved.pick.id, "big");
  assert.equal(moved.cycle.index, 0);
});
