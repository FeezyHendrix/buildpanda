import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDrawing, clusterDrawings } from "./clustering.ts";
import { smallBuilding, synth } from "./fixtures.ts";

// A sparse elevation: a 24 m outline, three floor lines and six windows a
// bay apart, the way a block of flats is drawn. Its lines are its only glue.
function sparseElevation(s: ReturnType<typeof synth>, ox: number): void {
  s.line("WALL", [ox, 0], [ox + 24000, 0]);
  s.line("WALL", [ox + 24000, 0], [ox + 24000, 7200]);
  s.line("WALL", [ox + 24000, 7200], [ox, 7200]);
  s.line("WALL", [ox, 7200], [ox, 0]);
  for (const y of [3000, 6000]) s.line("WALL", [ox, y], [ox + 24000, y]);
  for (const y of [900, 3900]) for (const x of [6000, 12000, 18000]) s.rect("WIND", ox + x - 600, y, 1200, 1200);
}

test("a sparse elevation whose windows sit a bay apart is one drawing, held together by its floor lines", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  sparseElevation(s, 40000);
  const clusters = clusterDrawings(s.doc(), 1);
  const elev = clusters.find((c) => c.minX >= 39000);
  assert.ok(elev, "the elevation forms a cluster");
  assert.ok(elev!.widthM > 23 && elev!.widthM < 25, `width ${elev!.widthM}`);
  assert.ok(elev!.heightM > 7, `height ${elev!.heightM}`);
  assert.equal(elev!.count, 12, "count is entities, not sample points");
});

test("a small drawing found by the dense pass and then judged too small is still rescued whole", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  // thirteen lines close together: dense enough for the first pass, too few to keep there
  for (let i = 0; i < 13; i++) s.line("WALL", [50000 + i * 300, 0], [50000 + i * 300, 3000]);
  const clusters = clusterDrawings(s.doc(), 1);
  const small = clusters.find((c) => c.minX >= 49000);
  assert.ok(small, "rescued as its own drawing");
  assert.equal(small!.count, 13);
});

test("a scale bar is not an elevation: a view is at least a storey tall", () => {
  const s = synth();
  for (let m = 0; m <= 10; m++) s.line("0", [m * 1000, 0], [m * 1000, 300]);
  s.line("0", [0, 0], [10000, 0]);
  s.line("0", [0, 300], [10000, 300]);
  const [bar] = clusterDrawings(s.doc(), 1, { minPts: 3 });
  assert.ok(bar);
  assert.equal(classifyDrawing(s.doc(), bar!), "detail");
});
