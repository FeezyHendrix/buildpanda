import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterRegions } from "./cluster.ts";
import type { ExtractedSheet, Segment } from "../types.ts";

const MM_PER_PT = 35.28; // 1:100 sheet: 1 paper-pt = 0.3528mm * 100 = 35.28mm real, so 0.30m = ~8.5pt

function seg(x1: number, y1: number, x2: number, y2: number): Segment {
  return { x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1), width: 0.3, color: "#000" };
}

function sheet(segments: Segment[]): ExtractedSheet {
  return { segments, curves: [], texts: [] };
}

test("clusterRegions: drops sub-0.30m noise so noise cannot bridge into the building region", () => {
  const walls: Segment[] = [];
  for (let i = 0; i < 40; i++) walls.push(seg(0, i * 3, 200, i * 3));
  for (let i = 0; i < 40; i++) walls.push(seg(i * 5, 0, i * 5, 120));
  const noise: Segment[] = [];
  for (let i = 0; i < 400; i++) noise.push(seg(300 + i, 300, 300 + i + 2, 302)); // sub-8.5pt glyph strokes trailing to a title block

  const withScale = clusterRegions(sheet([...walls, ...noise]), MM_PER_PT);
  assert.ok(withScale.length >= 1);
  const primary = withScale[0]!;
  assert.equal(primary.segmentIdx.length, walls.length, "primary region should be exactly the wall block, no noise");
  assert.ok(primary.maxX < 300, `region must not stretch to the title block at x>=300 (got maxX ${primary.maxX.toFixed(0)})`);

  const scaleBlind = clusterRegions(sheet([...walls, ...noise]));
  assert.ok(scaleBlind[0]!.maxX >= 300, "without a scale, noise still bridges into the title block (legacy behaviour)");
});

test("clusterRegions: without a scale it keeps the legacy scale-blind behaviour", () => {
  const walls: Segment[] = [];
  for (let i = 0; i < 40; i++) walls.push(seg(0, i * 3, 200, i * 3));
  const regions = clusterRegions(sheet(walls));
  assert.ok(regions.length >= 1);
});

test("clusterRegions: long wall faces are rasterised end to end, so a big plan is one region", () => {
  // a 30 m square of 6 m bays at 1:100: every face is ~170pt, far longer than a cell
  const bay = 6000 / MM_PER_PT;
  const walls: Segment[] = [];
  for (let i = 0; i <= 5; i++) {
    for (let j = 0; j < 5; j++) {
      // door gaps of 0.9 m in the middle of every internal face
      const gap = 900 / MM_PER_PT;
      const a = j * bay;
      const mid = a + bay / 2;
      walls.push(seg(i * bay, a, i * bay, mid - gap / 2), seg(i * bay, mid + gap / 2, i * bay, a + bay));
      walls.push(seg(a, i * bay, mid - gap / 2, i * bay), seg(mid + gap / 2, i * bay, a + bay, i * bay));
    }
  }
  const regions = clusterRegions(sheet(walls), MM_PER_PT);
  assert.equal(regions.length, 1, `expected one plan region, got ${regions.length}`);
  assert.equal(regions[0]!.segmentIdx.length, walls.length);
});

test("clusterRegions: a cluster nested inside another's extent joins it; a plan beside it stays separate", () => {
  const outer: Segment[] = [];
  for (let i = 0; i < 40; i++) outer.push(seg(0, i * 10, 400, i * 10));
  const inner: Segment[] = [];
  for (let i = 0; i < 35; i++) inner.push(seg(150 + i, 150, 150 + i + 20, 150 + 20)); // sits well inside the outer block
  const beside: Segment[] = [];
  for (let i = 0; i < 40; i++) beside.push(seg(2000, i * 10, 2400, i * 10));
  const regions = clusterRegions(sheet([...outer, ...inner, ...beside]), MM_PER_PT);
  assert.equal(regions.length, 2);
  assert.equal(regions[0]!.segmentIdx.length, outer.length + inner.length);
});

test("clusterRegions: an empty sheet yields no regions", () => {
  assert.deepEqual(clusterRegions(sheet([]), MM_PER_PT), []);
});
