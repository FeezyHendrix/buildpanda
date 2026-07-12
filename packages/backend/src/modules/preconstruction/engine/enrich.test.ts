import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAnchors, buildUpBill, evaluateFormula } from "./enrich.ts";
import type { MeasuredBoqItem } from "../types.ts";

const measured: MeasuredBoqItem[] = [
  {
    elementGroup: "Walls",
    workSection: { code: "F10", title: "BRICK/BLOCK WALLING" },
    specNote: null,
    code: "F10/125",
    description: "225mm hollow sandcrete blockwork in cement mortar (1:6)",
    unit: "m2",
    qtyGross: 4042.75,
    deductions: [],
    qty: 4042.75,
    confidence: "low",
    measurementBasis: "test",
    geometries: [],
    pageNumber: 2,
  },
  {
    elementGroup: "Windows and doors",
    workSection: { code: "L20", title: "DOORS" },
    specNote: null,
    code: "L20",
    description: "Door type D5; as door schedule",
    unit: "nr",
    qtyGross: 15,
    deductions: [],
    qty: 15,
    confidence: "high",
    measurementBasis: "test",
    geometries: [],
    pageNumber: 2,
  },
];

test("buildAnchors extracts wall area and typed counts", () => {
  const anchors = buildAnchors(measured);
  assert.equal(anchors["wall_area_m2"], 4042.75);
  assert.equal(anchors["door_D5"], 15);
  assert.equal(anchors["door_total"], 15);
});

test("evaluateFormula: arithmetic over anchors, no eval tricks", () => {
  const anchors = { wall_area_m2: 100, door_total: 4 };
  assert.equal(evaluateFormula("2 * wall_area_m2", anchors), 200);
  assert.equal(evaluateFormula("wall_area_m2 * 0.012", anchors), 1.2);
  assert.equal(evaluateFormula("(wall_area_m2 + 50) / 2", anchors), 75);
  assert.equal(evaluateFormula("unknown_anchor * 2", anchors), null); // unknown anchor dies
  assert.equal(evaluateFormula("wall_area_m2 / 0", anchors), null); // division by zero dies
  assert.equal(evaluateFormula("process.exit(1)", anchors), null); // not arithmetic
  assert.equal(evaluateFormula("wall_area_m2 - 200", anchors), null); // negative quantity dies
});

test("buildUpBill: quantities come from the engine, never the model", async () => {
  const fakeLlm = async () => ({
    data: {
      workSections: [
        {
          sectionNumber: "1.28",
          title: "FLOOR WALL CEILING AND ROOF FINISHINGS",
          groups: [
            {
              preamble: "Cement and sand (1:4) smooth rendering",
              heading: null,
              items: [
                {
                  besmmRef: "7.2.0",
                  particulars: "Plastering to Walls 12mm thick; over 600mm wide; internally",
                  unit: "m2" as const,
                  basis: "derived" as const,
                  formula: "2 * wall_area_m2",
                },
                {
                  besmmRef: "7.2.1",
                  particulars: "Item with a made-up anchor that must be discarded",
                  unit: "m2" as const,
                  basis: "derived" as const,
                  formula: "made_up_anchor * 3",
                },
                {
                  besmmRef: null,
                  particulars: "Electrical installations complete",
                  unit: "sum" as const,
                  basis: "provisional" as const,
                },
              ],
            },
          ],
        },
      ],
    },
  });
  const outcome = await buildUpBill(measured, "test context", fakeLlm as never);
  const render = outcome.items.find((i) => i.code === "7.2.0");
  assert.ok(render, "derived render item survives");
  assert.equal(render.qty, 8085.5); // 2 x 4042.75, computed by the engine
  assert.match(render.measurementBasis, /engine-evaluated/);
  assert.equal(render.specNote, "Cement and sand (1:4) smooth rendering"); // preamble travels with first group item
  assert.equal(outcome.items.find((i) => i.code === "7.2.1"), undefined); // unknown anchor discarded
  const provisional = outcome.items.find((i) => i.description === "Electrical installations complete");
  assert.ok(provisional);
  assert.equal(provisional.provisional, true);
  assert.equal(provisional.qty, 0);
});

test("buildUpBill: failed agent degrades to empty, never throws", async () => {
  const failing = async () => {
    throw new Error("model down");
  };
  const outcome = await buildUpBill(measured, "ctx", failing as never);
  assert.equal(outcome.items.length, 0);
  assert.ok(outcome.agentResults.every((r) => r.failed));
});
