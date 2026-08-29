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

test("clusterRegions: an empty sheet yields no regions", () => {
  assert.deepEqual(clusterRegions(sheet([]), MM_PER_PT), []);
});
