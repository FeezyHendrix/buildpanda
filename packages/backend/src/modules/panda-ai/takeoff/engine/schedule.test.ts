import { test } from "node:test";
import assert from "node:assert/strict";
import { applySchedules, readSchedules, readingOrderLines } from "./schedule.ts";
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
  });
  const w4 = items.find((i) => /W4/.test(i.description))!;
  assert.equal(w4.qty, 96); // schedule beats census
  assert.equal(w4.confidence, "low"); // 96 vs 84 disagreement flagged
  assert.match(w4.measurementBasis, /DISCREPANCY/);
  assert.match(w4.description, /1200 x 1200mm/);
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
  const items = applySchedules([wall, openingItem("L11", "W9", 10)], { windows: [], doors: [] });
  assert.equal(items[0]!.description, "blockwork");
  assert.equal(items[1]!.qty, 10);
});
