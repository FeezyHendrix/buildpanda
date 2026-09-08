import { test } from "node:test";
import assert from "node:assert/strict";
import { extractGeometry, type PdfOps } from "./pdf-extract.ts";

// pdf.js operator ids as the real OPS table numbers them
const OPS: Required<PdfOps> = {
  save: 10,
  restore: 11,
  transform: 12,
  setLineWidth: 2,
  setStrokeRGBColor: 58,
  constructPath: 91,
  beginMarkedContentProps: 70,
  endMarkedContent: 71,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  eoFillStroke: 25,
  closeFillStroke: 26,
  closeEOFillStroke: 27,
  paintJpegXObject: 82,
  paintImageMaskXObject: 83,
  paintImageXObject: 85,
  paintInlineImageXObject: 86,
};
const STROKE = 20;

type Op = [number, unknown[]];
const ops = (list: Op[]) => ({ fnArray: list.map((o) => o[0]), argsArray: list.map((o) => o[1]) });
const path = (paint: number, ...data: number[]): Op => [OPS.constructPath, [paint, [Float32Array.from(data)], null]];
const line = (paint: number, x1: number, y1: number, x2: number, y2: number) => path(paint, 0, x1, y1, 1, x2, y2);

test("extractGeometry: line width is scaled by the current transform", () => {
  const { segments } = extractGeometry(
    ops([
      [OPS.setLineWidth, [0.5]],
      line(STROKE, 0, 0, 10, 0),
      [OPS.transform, [4, 0, 0, 4, 0, 0]],
      line(STROKE, 0, 0, 10, 0),
    ]),
    OPS,
  );
  assert.equal(segments.length, 2);
  assert.equal(segments[0]!.width, 0.5);
  assert.equal(segments[1]!.width, 2);
  assert.equal(segments[1]!.x2, 40, "coordinates go through the same transform");
});

test("extractGeometry: q/Q restores the line width and colour, not only the matrix", () => {
  const { segments } = extractGeometry(
    ops([
      [OPS.setLineWidth, [0.1]],
      [OPS.save, []],
      [OPS.setLineWidth, [0.9]],
      [OPS.transform, [2, 0, 0, 2, 0, 0]],
      line(STROKE, 0, 0, 5, 0),
      [OPS.restore, []],
      line(STROKE, 0, 0, 5, 0),
    ]),
    OPS,
  );
  assert.equal(segments[0]!.width, 1.8);
  assert.equal(segments[1]!.width, 0.1);
  assert.equal(segments[1]!.x2, 5);
});

test("extractGeometry: fill operators mark segments as filled and close the outline, strokes do not", () => {
  const { segments } = extractGeometry(ops([line(OPS.fill, 0, 0, 1, 1), line(STROKE, 0, 0, 1, 1)]), OPS);
  assert.equal(segments.length, 3, "the filled subpath gains its implicit closing side");
  assert.equal(segments[0]!.fill, true);
  assert.equal(segments[1]!.closed, true);
  assert.equal(segments[2]!.fill, false);
  assert.equal(segments[2]!.closed, false);
});

test("extractGeometry: optional-content groups become the segment layer", () => {
  const { segments } = extractGeometry(
    ops([
      [OPS.beginMarkedContentProps, ["OC", { name: "A-WALL" }]],
      line(STROKE, 0, 0, 1, 0),
      [OPS.beginMarkedContentProps, ["Span", null]],
      line(STROKE, 0, 0, 2, 0),
      [OPS.endMarkedContent, []],
      [OPS.endMarkedContent, []],
      line(STROKE, 0, 0, 3, 0),
    ]),
    OPS,
  );
  assert.deepEqual(
    segments.map((s) => s.layer),
    ["A-WALL", "A-WALL", null],
  );
});

test("extractGeometry: closePath (op 4) emits the closing side and marks the subpath closed", () => {
  const { segments } = extractGeometry(ops([path(STROKE, 0, 0, 0, 1, 10, 0, 1, 10, 5, 1, 0, 5, 4)]), OPS);
  assert.equal(segments.length, 4, "three lineTo sides plus the closing side");
  assert.ok(segments.every((s) => s.closed));
  assert.equal(new Set(segments.map((s) => s.path)).size, 1);
  const last = segments[3]!;
  assert.deepEqual([last.x1, last.y1, last.x2, last.y2], [0, 5, 0, 0]);
});

test("extractGeometry: a quadratic curve (op 3) consumes four coordinates and lands as a curve", () => {
  const { segments, curves } = extractGeometry(ops([path(STROKE, 0, 0, 0, 3, 5, 5, 10, 0, 1, 10, 10)]), OPS);
  assert.equal(curves.length, 1);
  assert.equal(curves[0]!.ex, 10);
  assert.equal(segments.length, 1);
  assert.deepEqual([segments[0]!.x1, segments[0]!.y1, segments[0]!.x2, segments[0]!.y2], [10, 0, 10, 10]);
});

test("extractGeometry: works with only the six required op ids", () => {
  const minimal: PdfOps = { save: 10, restore: 11, transform: 12, setLineWidth: 2, setStrokeRGBColor: 58, constructPath: 91 };
  const { segments } = extractGeometry(ops([line(STROKE, 0, 0, 1, 0)]), minimal);
  assert.equal(segments.length, 1);
  assert.equal(segments[0]!.layer, null);
});
