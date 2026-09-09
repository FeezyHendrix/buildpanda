import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SheetViewport } from "@/api/precon";
import { ARC_SEGMENTS, EMPTY_DRAFT, addDraftPoint, arcThroughPoints, rectOf, rectangleVertices, scaleForDraft, viewportAt } from "./draft-maths";

const close = (actual: number, expected: number, message?: string) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ""} expected ${expected}, got ${actual}`);

describe("arcThroughPoints", () => {
  it("densifies a semicircle into sixteen segments that all sit on the circle", () => {
    // unit circle centred on the origin: from (1,0) through (0,1) to (-1,0)
    const pts = arcThroughPoints([1, 0], [0, 1], [-1, 0]);
    assert.equal(pts.length, ARC_SEGMENTS + 1);
    assert.deepEqual(pts[0], [1, 0]);
    assert.deepEqual(pts[ARC_SEGMENTS], [-1, 0]);
    for (const p of pts) close(Math.hypot(p[0]!, p[1]!), 1, "radius");
    // it went the way that passes through the middle point (positive y)
    close(pts[ARC_SEGMENTS / 2]![0]!, 0);
    close(pts[ARC_SEGMENTS / 2]![1]!, 1);
  });

  it("goes the other way round when the middle point is on the other side", () => {
    const pts = arcThroughPoints([1, 0], [0, -1], [-1, 0]);
    close(pts[ARC_SEGMENTS / 2]![1]!, -1);
  });

  it("falls back to a straight line for collinear points", () => {
    assert.deepEqual(arcThroughPoints([0, 0], [5, 5], [10, 10]), [
      [0, 0],
      [10, 10],
    ]);
  });

  it("measures close to the true arc length", () => {
    const pts = arcThroughPoints([100, 0], [0, 100], [-100, 0]);
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]![0]! - pts[i - 1]![0]!, pts[i]![1]! - pts[i - 1]![1]!);
    const trueLength = Math.PI * 100;
    assert.ok(Math.abs(len - trueLength) / trueLength < 0.01, `chord sum ${len} within 1% of ${trueLength}`);
  });
});

describe("rectangleVertices", () => {
  it("returns four corners in one turn whichever way the drag went", () => {
    assert.deepEqual(rectangleVertices([10, 20], [0, 5]), [
      [0, 5],
      [10, 5],
      [10, 20],
      [0, 20],
    ]);
    assert.deepEqual(rectOf([10, 20], [0, 5]), [0, 5, 10, 20]);
  });
});

describe("viewportAt", () => {
  const viewports: SheetViewport[] = [
    { id: "a", label: "Detail A", rect: [0, 0, 100, 100], scaleMmPerPt: 5 },
    { id: "b", label: "Detail B", rect: [200, 200, 300, 300], scaleMmPerPt: 10 },
  ];

  it("picks the viewport whose rect contains the point, else nothing", () => {
    assert.equal(viewportAt(viewports, [50, 50])?.id, "a");
    assert.equal(viewportAt(viewports, [250, 250])?.id, "b");
    assert.equal(viewportAt(viewports, [150, 150]), null);
    assert.equal(viewportAt(null, [50, 50]), null);
    assert.equal(viewportAt(viewports, undefined), null);
  });

  it("scales a draft by the viewport its first vertex is in, else by the sheet", () => {
    assert.equal(scaleForDraft(1, viewports, [[50, 50], [400, 400]]), 5);
    assert.equal(scaleForDraft(1, viewports, [[150, 150], [50, 50]]), 1);
    assert.equal(scaleForDraft(null, viewports, []), null);
  });
});

describe("addDraftPoint", () => {
  it("adds a plain click as one vertex and one anchor", () => {
    const next = addDraftPoint(EMPTY_DRAFT, [1, 1], false);
    assert.deepEqual(next, { vertices: [[1, 1]], anchors: [[1, 1]], arcMid: null });
  });

  it("ignores Alt on the first click (an arc needs a start)", () => {
    assert.deepEqual(addDraftPoint(EMPTY_DRAFT, [1, 1], true).vertices, [[1, 1]]);
  });

  it("closes an arc on the click after an Alt-click, adding sixteen segments for one anchor", () => {
    const one = addDraftPoint(EMPTY_DRAFT, [1, 0], false);
    const mid = addDraftPoint(one, [0, 1], true);
    assert.deepEqual(mid.arcMid, [0, 1]);
    assert.equal(mid.vertices.length, 1);
    const done = addDraftPoint(mid, [-1, 0], false);
    assert.equal(done.arcMid, null);
    assert.equal(done.vertices.length, 1 + ARC_SEGMENTS);
    assert.equal(done.anchors.length, 2);
    assert.deepEqual(done.vertices[done.vertices.length - 1], [-1, 0]);
  });
});
