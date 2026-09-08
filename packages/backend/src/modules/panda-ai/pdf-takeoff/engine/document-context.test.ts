import { test } from "node:test";
import assert from "node:assert/strict";
import type { Segment, TextRun } from "../types.ts";
import { buildDocumentContext, levelMarks, storeyHeightFromLevels, windowHeightFromElevations } from "./document-context.ts";

const txt = (str: string): TextRun => ({ str, x: 0, y: 0, w: 10, rotated: false });
const MM_PER_PT = 35.28;
let nextPath = 1;
function rect(x: number, y: number, wMm: number, hMm: number): Segment[] {
  const path = nextPath++;
  const w = wMm / MM_PER_PT;
  const h = hMm / MM_PER_PT;
  const mk = (x1: number, y1: number, x2: number, y2: number): Segment => ({ x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1), width: 0.1, color: "#000", path, closed: true });
  return [mk(x, y, x + w, y), mk(x + w, y, x + w, y + h), mk(x + w, y + h, x, y + h), mk(x, y + h, x, y)];
}

test("levelMarks: reads signed mm and metre marks, ignores unsigned dimensions", () => {
  const levels = levelMarks([txt("+450"), txt("+3450 FIRST FLOOR SLAB"), txt("FFL +6.450"), txt("-1200"), txt("4500"), txt("SCALE 1:100")]);
  assert.deepEqual(levels, [-1200, 450, 3450, 6450]);
});

test("storeyHeightFromLevels: the modal step between consecutive marks, in metres", () => {
  assert.equal(storeyHeightFromLevels([450, 3450, 6450, 9450, 60450]), 3);
  assert.equal(storeyHeightFromLevels([450]), null);
  assert.equal(storeyHeightFromLevels([450, 12000]), null, "a single 11.5 m step is not a storey");
});

test("windowHeightFromElevations: the modal upright window outline height, never a plan frame", () => {
  const elevation = [...rect(10, 10, 1200, 1200), ...rect(100, 10, 1200, 1200), ...rect(200, 10, 900, 1500)];
  const plan = rect(10, 10, 1200, 120);
  const height = windowHeightFromElevations(
    [
      { texts: [], segments: elevation, mmPerPt: MM_PER_PT },
      { texts: [], segments: plan, mmPerPt: MM_PER_PT },
    ],
    null,
    3,
  );
  assert.equal(height, 1.2);
});

test("buildDocumentContext: says what it assumed when the document gives it nothing", () => {
  const ctx = buildDocumentContext([{ texts: [txt("GROUND FLOOR PLAN")], segments: [], mmPerPt: MM_PER_PT }]);
  assert.equal(ctx.storeyHeightBasis, "assumed");
  assert.equal(ctx.storeyHeightM, 2.7);
  assert.equal(ctx.windowHeightBasis, "assumed");
  assert.equal(ctx.doorHeightBasis, "assumed");
});

test("buildDocumentContext: an uncalibrated elevation borrows the plans' scale for its window heights", () => {
  const ctx = buildDocumentContext([
    { texts: [txt("+450"), txt("+3450")], segments: [], mmPerPt: MM_PER_PT },
    { texts: [], segments: [...rect(10, 10, 1200, 1200), ...rect(100, 10, 1200, 1200)], mmPerPt: null },
  ]);
  assert.equal(ctx.storeyHeightBasis, "level-marks");
  assert.equal(ctx.storeyHeightM, 3);
  assert.equal(ctx.windowHeightBasis, "elevation");
  assert.equal(ctx.windowHeightM, 1.2);
});
