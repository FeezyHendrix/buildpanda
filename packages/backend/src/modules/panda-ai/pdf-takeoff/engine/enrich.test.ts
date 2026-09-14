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

test("buildUpBill: injects the BESMM reference block into the element prompt", async () => {
  let sawBesmmBlock = false;
  const fakeLlm = async (messages: Array<{ content: string }>) => {
    const joined = messages.map((m) => m.content).join("\n");
    if (/<besmm_reference source="BESMM4/.test(joined) && /BESMM REFERENCE RULES:/.test(joined)) {
      sawBesmmBlock = true;
    }
    return { data: { workSections: [] } };
  };
  await buildUpBill(measured, "ctx", fakeLlm as never);
  assert.ok(sawBesmmBlock, "agent prompt must carry the <besmm_reference> block with cited pages");
});

test("buildUpBill: an item's cited BESMM pages are whitelisted to the element's own references", async () => {
  // Only answer for the Wall finishings agent so the assertion targets one element.
  const fakeLlm = async (messages: Array<{ content: string }>) => {
    const isWallFinishings = messages.some((m) => /ELEMENT: Wall finishings/.test(m.content));
    if (!isWallFinishings) return { data: { workSections: [] } };
    return {
      data: {
        workSections: [
          {
            sectionNumber: "1.28",
            title: "FINISHINGS",
            groups: [
              {
                preamble: null,
                heading: null,
                items: [
                  {
                    besmmRef: "7.2.0",
                    particulars: "Plastering to walls; internally",
                    unit: "m2" as const,
                    basis: "derived" as const,
                    formula: "2 * wall_area_m2",
                    refPages: [9999, 249], // 9999 fabricated -> dropped; 249 is a real wall-finishings ref page
                  },
                ],
              },
            ],
          },
        ],
      },
    };
  };
  const outcome = await buildUpBill(measured, "ctx", fakeLlm as never);
  const item = outcome.items.find((i) => i.code === "7.2.0");
  assert.ok(item);
  assert.doesNotMatch(item.measurementBasis, /9999/, "fabricated page must be stripped");
  assert.match(item.measurementBasis, /BESMM4 p\.249/, "valid cited page is kept");
});

test("buildUpBill: failed agent degrades to empty, never throws", async () => {
  const failing = async () => {
    throw new Error("model down");
  };
  const outcome = await buildUpBill(measured, "ctx", failing as never);
  assert.equal(outcome.items.length, 0);
  assert.ok(outcome.agentResults.every((r) => r.failed));
});

test("anchorsFromRows rebuilds anchors from live bill rows, skipping rejected", async () => {
  const { anchorsFromRows } = await import("./enrich.ts");
  const rows = [
    { code: "F10/125", description: "blockwork", qty: 270, status: "verified" },
    { code: "L20", description: "Door type D5; as door schedule", qty: 19, status: "ai_generated" },
    { code: "L11", description: "Window type W4; as window schedule", qty: 96, status: "rejected" },
  ] as never[];
  const anchors = anchorsFromRows(rows as never);
  assert.equal(anchors["wall_area_m2"], 270);
  assert.equal(anchors["wall_centreline_m"], 100);
  assert.equal(anchors["door_D5"], 19);
  assert.equal(anchors["window_W4"], undefined); // rejected excluded
});
