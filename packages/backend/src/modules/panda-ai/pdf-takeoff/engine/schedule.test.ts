import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOpeningDeductions, applySchedules, readSchedules, readingOrderLines } from "./schedule.ts";
import type { MeasuredBoqItem, TextRun } from "../types.ts";

const text = (str: string, x: number, y: number): TextRun => ({ str, x, y, w: 10, rotated: false });

test("readingOrderLines rebuilds table rows top-to-bottom, cells left-to-right", () => {
  const lines = readingOrderLines([
    text("W-4", 10, 100),
    text("96", 60, 100.5),
    text("aluminium frame", 120, 99.8),
    text("window schedule", 10, 130),
    text("W-6", 10, 80),
  ]);
  assert.deepEqual(lines, ["window schedule", "W-4 | 96 | aluminium frame", "W-6"]);
});

test("readSchedules transcribes and normalizes types, drops junk", async () => {
  const fakeLlm = async () => ({
    data: {
      windows: [
        { type: "W-4", quantity: 96, widthMm: 1200, heightMm: 1200, material: "aluminium frame", remarks: null },
        { type: "W-4", quantity: 96, widthMm: null, heightMm: null, material: null, remarks: null }, // dupe dropped
        { type: "TOTAL", quantity: 150, widthMm: null, heightMm: null, material: null, remarks: null }, // not a type
      ],
      doors: [{ type: "d5", quantity: 19, widthMm: 900, heightMm: 2100, material: "solid core", remarks: null }],
    },
  });
  const schedules = await readSchedules([{ pageNumber: 11, lines: ["..."] }], fakeLlm as never);
  assert.ok(schedules);
  assert.equal(schedules.windows.length, 1);
  assert.equal(schedules.windows[0]!.type, "W4");
  assert.equal(schedules.doors[0]!.type, "D5");
});

function openingItem(code: "L11" | "L20", type: string, qty: number): MeasuredBoqItem {
  return {
    elementGroup: code === "L11" ? "Windows" : "Doors",
    workSection: { code, title: "X" },
    specNote: null,
    code,
    description: `${code === "L11" ? "Window" : "Door"} type ${type}; as ${code === "L11" ? "window" : "door"} schedule`,
    unit: "nr",
    qtyGross: qty,
    deductions: [],
    qty,
    confidence: "high",
    measurementBasis: `${qty} tags`,
    geometries: [],
    pageNumber: 2,
  };
}

test("applySchedules: schedule quantity wins, agreement keeps high confidence", () => {
  const items = applySchedules([openingItem("L11", "W4", 84), openingItem("L20", "D5", 19)], {
    windows: [{ type: "W4", quantity: 96, widthMm: 1200, heightMm: 1200, material: "aluminium frame", remarks: null }],
    doors: [{ type: "D5", quantity: 19, widthMm: null, heightMm: null, material: null, remarks: null }],
    vents: [],
  });
  const w4 = items.find((i) => /W4/.test(i.description))!;
  assert.equal(w4.qty, 96); // schedule beats census
  assert.equal(w4.confidence, "low"); // 96 vs 84 disagreement flagged
  assert.match(w4.measurementBasis, /DISCREPANCY/);
  assert.match(w4.description, /1200 x 1200 as schedule/);
  assert.match(w4.description, /aluminium frame/);
  const d5 = items.find((i) => /D5/.test(i.description))!;
  assert.equal(d5.qty, 19);
  assert.equal(d5.confidence, "high"); // census agrees
  assert.match(d5.measurementBasis, /tag census agrees/);
});

test("applySchedules leaves unmatched items untouched", () => {
  const wall = {
    ...openingItem("L11", "W9", 10),
    code: "F10/125",
    description: "blockwork",
  } as MeasuredBoqItem;
  const items = applySchedules([wall, openingItem("L11", "W9", 10)], { windows: [], doors: [], vents: [] });
  assert.equal(items[0]!.description, "blockwork");
  assert.equal(items[1]!.qty, 10);
});

function wallItem(grossM2: number): MeasuredBoqItem {
  return {
    elementGroup: "Internal and external walls",
    workSection: { code: "F10", title: "BRICK/BLOCK WALLING" },
    specNote: null,
    code: "F10/125",
    description: "blockwork",
    unit: "m2",
    qtyGross: grossM2,
    deductions: [],
    qty: grossM2,
    confidence: "high",
    measurementBasis: `${grossM2}m2 gross`,
    geometries: [],
    pageNumber: 2,
  };
}

test("applyOpeningDeductions: ventilation openings come off the gross wall (BESMM net)", () => {
  const [wall] = applyOpeningDeductions([wallItem(100)], {
    windows: [{ type: "W1", quantity: 2, widthMm: 1200, heightMm: 1200, material: null, remarks: null }], // 2 x 1.44 = 2.88
    doors: [{ type: "D1", quantity: 1, widthMm: 900, heightMm: 2100, material: null, remarks: null }], // 1.89
    vents: [{ type: "V1", quantity: 3, widthMm: 900, heightMm: 900, material: null, remarks: null }], // 3 x 0.81 = 2.43 (each > 0.50)
  });
  // gross 100 less (2.88 + 1.89 + 2.43) = 92.80 net
  assert.equal(wall!.qty, 92.8);
  assert.ok(wall!.deductions.some((d) => /Ventilation openings \(3 nr/.test(d.label)));
});

test("applyOpeningDeductions: a masonry void <= 0.50 m2 is NOT deducted (BESMM4 p183)", () => {
  const [wall] = applyOpeningDeductions([wallItem(50)], {
    // a large window fixes scale as mm (not cm), so the vent size is read literally
    windows: [{ type: "W1", quantity: 1, widthMm: 1500, heightMm: 1500, material: null, remarks: null }], // 2.25 deducted
    doors: [],
    vents: [{ type: "V2", quantity: 5, widthMm: 300, heightMm: 300, material: null, remarks: null }], // each 0.09 m2 <= 0.50 -> skipped
  });
  assert.equal(wall!.qty, 47.75); // 50 - 2.25 window; sub-0.50 vents ignored
  assert.ok(!wall!.deductions.some((d) => /Ventilation/.test(d.label)));
});

test("applyOpeningDeductions: a 0.36 m2 void is NOT deducted (0.10-0.50 band, BESMM4 p183)", () => {
  const [wall] = applyOpeningDeductions([wallItem(50)], {
    windows: [{ type: "W1", quantity: 1, widthMm: 1500, heightMm: 1500, material: null, remarks: null }], // 2.25 deducted
    doors: [],
    vents: [{ type: "V1", quantity: 4, widthMm: 600, heightMm: 600, material: null, remarks: null }], // each 0.36 m2 <= 0.50 -> skipped
  });
  assert.equal(wall!.qty, 47.75); // only the window comes off; 0.36 m2 openings are within tolerance
  assert.ok(!wall!.deductions.some((d) => /Ventilation/.test(d.label)));
});

test("inferScheduleScale: cm-looking schedules read x10, mm left alone", async () => {
  const { inferScheduleScale } = await import("./schedule.ts");
  const entry = (w: number, h: number) => ({ type: "W1", quantity: 1, widthMm: w, heightMm: h, material: null, remarks: null });
  assert.equal(inferScheduleScale([entry(138, 140), entry(66, 210), entry(120, 120)]), 10);
  assert.equal(inferScheduleScale([entry(1380, 1400), entry(660, 2100)]), 1);
  assert.equal(inferScheduleScale([]), 1);
});
