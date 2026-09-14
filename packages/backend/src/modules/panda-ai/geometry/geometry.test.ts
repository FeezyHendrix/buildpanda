import { test } from "node:test";
import assert from "node:assert/strict";
import type { DwgDoc, DwgEntity } from "../dwg-takeoff/dwg.ts";
import { fromDwg, inferUnits } from "./from-dwg.ts";
import { fromPdf } from "./from-pdf.ts";
import { buildReport, elementForLayer, summarise } from "./report.ts";

// A hand-built dwgread document: a model-space block header, one block
// definition, one insert of it with an attribute, walls, a closed column
// outline, a dimension, and a paper-space title block line.
function doc(entities: DwgEntity[], header?: DwgDoc["header"]): DwgDoc {
  const layerNames: Record<number, string> = { 10: "WALL", 11: "COLUMN", 12: "DIM" };
  return {
    entities,
    layerName: (e) => layerNames[e.layer?.[e.layer.length - 1] ?? -1] ?? "0",
    header,
  };
}

const MODEL_HEADER: DwgEntity = { object: "BLOCK_HEADER", name: "*MODEL_SPACE", handle: [0, 1, 2] };
const DOOR_BLOCK: DwgEntity = { object: "BLOCK_HEADER", name: "DOOR-900", handle: [0, 1, 50] };

function sample(): DwgEntity[] {
  return [
    MODEL_HEADER,
    DOOR_BLOCK,
    { object: "LAYER", name: "WALL", handle: [0, 1, 10], color: 1 },
    { object: "LAYER", name: "COLUMN", handle: [0, 1, 11], color: 2 },
    { object: "LAYER", name: "DIM", handle: [0, 1, 12], color: 3 },
    // block definition geometry: owned by the door block, must not be measured
    { entity: "LINE", entmode: 0, ownerhandle: [0, 1, 50], handle: [0, 1, 51], layer: [0, 1, 10], start: [0, 0, 0], end: [900, 0, 0] },
    // model space walls (double line)
    { entity: "LINE", entmode: 2, handle: [0, 1, 100], layer: [0, 1, 10], start: [0, 0, 0], end: [6000, 0, 0] },
    { entity: "LINE", entmode: 2, handle: [0, 1, 101], layer: [0, 1, 10], start: [0, 225, 0], end: [6000, 225, 0] },
    // closed column outline
    { entity: "LWPOLYLINE", entmode: 2, handle: [0, 1, 102], layer: [0, 1, 11], flag: 512, points: [[0, 0], [300, 0], [300, 300], [0, 300]] },
    // one door insert with a tag attribute
    { entity: "INSERT", entmode: 2, handle: [0, 1, 103], layer: [0, 1, 10], block_header: [5, 1, 50, 50], ins_pt: [1000, 0, 0], scale: [1, 1, 1], rotation: 0 },
    { entity: "ATTRIB", entmode: 0, handle: [0, 1, 104], ownerhandle: [0, 1, 103], layer: [0, 1, 10], tag: "TAG", text_value: "D1", ins_pt: [1000, 0, 0] },
    // dimension across the wall
    { entity: "DIMENSION_LINEAR", entmode: 2, handle: [0, 1, 105], layer: [0, 1, 12], act_measurement: 6000, xline1_pt: [0, 0, 0], xline2_pt: [6000, 0, 0] },
    // room label
    { entity: "TEXT", entmode: 2, handle: [0, 1, 106], layer: [0, 1, 12], text_value: "KITCHEN", ins_pt: [3000, 100, 0], height: 250 },
    // paper space title block line
    { entity: "LINE", entmode: 1, handle: [0, 1, 107], layer: [0, 1, 10], start: [0, 0, 0], end: [100, 0, 0] },
  ];
}

test("fromDwg keeps model space only and catalogues block definitions", () => {
  const geo = fromDwg(doc(sample()));
  // 2 wall lines + 3 polyline edges + closing edge = 6 segments; the block
  // definition line and the paper-space line are not among them
  assert.equal(geo.segments.length, 6);
  assert.ok(geo.segments.every((s) => s.id !== "51" && s.id !== "107"));
  assert.equal(geo.shapes.length, 1);
  assert.equal(geo.shapes[0]?.kind, "polyline");
  assert.deepEqual(geo.blocks, [{ name: "DOOR-900", inserts: 1, entities: 1 }]);
  assert.equal(geo.unreadable.find((u) => u.what === "paper space")?.count, 1);
});

test("fromDwg attaches attributes to their insert and reads dimensions and text", () => {
  const geo = fromDwg(doc(sample()));
  assert.equal(geo.inserts.length, 1);
  assert.equal(geo.inserts[0]?.blockName, "DOOR-900");
  assert.deepEqual(geo.inserts[0]?.attributes, { TAG: "D1" });
  assert.equal(geo.dimensions.length, 1);
  assert.equal(geo.dimensions[0]?.value, 6000);
  // the attribute text is also a text run, kind attrib
  assert.deepEqual(geo.texts.map((t) => t.kind).sort(), ["attrib", "text"]);
  assert.equal(geo.layers.find((l) => l.name === "WALL")?.color, 1);
});

test("inferUnits prefers the header, then the dimension band, then says it assumed", () => {
  assert.equal(inferUnits({ INSUNITS: 6 }, []).unit, "m");
  assert.equal(inferUnits({ INSUNITS: 6 }, []).basis, "header");
  const mm = inferUnits({ INSUNITS: 0 }, [900, 1300, 4500, 6000, 12000]);
  assert.equal(mm.unit, "mm");
  assert.equal(mm.basis, "dimensions");
  const m = inferUnits(undefined, [0.9, 1.3, 4.5, 6]);
  assert.equal(m.unit, "m");
  const assumed = inferUnits(undefined, []);
  assert.equal(assumed.basis, "assumed");
  assert.ok(assumed.confidence < 0.5);
});

test("buildReport maps layers to the elements today's rules read and computes coverage", () => {
  const report = buildReport(fromDwg(doc(sample(), { INSUNITS: 4 })));
  assert.equal(report.units.unit, "mm");
  assert.equal(elementForLayer("hide-WALLS"), "walls"); // the rule the engine actually applies, flaws included
  assert.equal(elementForLayer("FURNITURE"), "furniture");
  assert.equal(elementForLayer("Grid"), "grid");
  const wall = report.layers.find((l) => l.name === "WALL");
  assert.equal(wall?.element, "walls");
  assert.equal(wall?.byType["insert"], 1);
  // geometry: 2 lines + 1 insert on WALL, 1 polyline (+ its edges, counted once) on COLUMN, all consumed
  assert.equal(report.coverage.measuredShare, 1);
  assert.deepEqual(report.coverage.measuredLayers, ["COLUMN", "WALL"]);
  assert.equal(report.dimensions.median, 6000);
  assert.ok(report.texts.some((t) => t.text === "KITCHEN"));
  assert.equal(report.warnings.length, 0);
  const summary = summarise(report);
  assert.equal(summary.topLayers[0]?.name, "WALL");
});

test("buildReport warns when most geometry sits on ignored layers or units are assumed", () => {
  // walls and the column outline move to an unnamed layer; only the door insert stays measurable
  const entities = sample().map((e) => ((e.entity === "LINE" || e.entity === "LWPOLYLINE") && e.entmode === 2 ? { ...e, layer: [0, 1, 99] } : e));
  const report = buildReport(fromDwg(doc(entities)));
  assert.ok(report.coverage.measuredShare < 0.5);
  assert.ok(report.warnings.some((w) => /ignored|geometry is on a layer/i.test(w)));
  const noDims = buildReport(fromDwg(doc(sample().filter((e) => !String(e.entity ?? "").startsWith("DIMENSION")))));
  assert.equal(noDims.units.basis, "assumed");
  assert.ok(noDims.warnings.some((w) => /assumed/i.test(w)));
});

test("fromPdf recovers fills, scaled widths and optional-content layers from the operator list", () => {
  const OPS = { save: 10, restore: 11, transform: 12, setLineWidth: 4, constructPath: 91, beginMarkedContentProps: 70, endMarkedContent: 71, fill: 22, stroke: 20 };
  const line = (x1: number, y1: number, x2: number, y2: number) => new Float32Array([0, x1, y1, 1, x2, y2]);
  const ops = {
    fnArray: [OPS.transform, OPS.setLineWidth, OPS.beginMarkedContentProps, OPS.constructPath, OPS.endMarkedContent, OPS.constructPath],
    argsArray: [[2, 0, 0, 2, 0, 0], [0.5], ["OC", { name: "A-WALL" }], [OPS.stroke, [line(0, 0, 10, 0)]], [], [OPS.fill, [line(0, 0, 5, 5)]]],
  };
  const geo = fromPdf({ segments: [], curves: [], texts: [{ str: "3600", x: 1, y: 1, w: 10, rotated: false }] }, ops, OPS);
  assert.equal(geo.segments.length, 2);
  assert.equal(geo.segments[0]?.layer, "A-WALL");
  assert.equal(geo.segments[0]?.width, 1); // 0.5 × the transform's scale of 2
  assert.equal(geo.segments[0]?.fill, false);
  assert.equal(geo.segments[1]?.layer, null);
  assert.equal(geo.segments[1]?.fill, true);
  assert.equal(geo.layers[0]?.name, "A-WALL");
  const report = buildReport(geo);
  assert.equal(report.layers.find((l) => l.name === "A-WALL")?.element, "walls");
  assert.equal(report.units.basis, "assumed");
});
