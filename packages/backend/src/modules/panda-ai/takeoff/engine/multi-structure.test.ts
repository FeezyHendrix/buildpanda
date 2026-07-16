import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyStructure } from "./classify.ts";
import { briefsFor } from "./besmm-reference.ts";
import { readBbs, bbsToItems, readPileSchedule, pileScheduleToItems } from "./structural-schedule.ts";
import { measureCivil, civilToItems } from "./civil-measure.ts";
import type { Segment } from "../types.ts";

function seg(x1: number, y1: number, x2: number, y2: number): Segment {
  return { x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1), width: 0.3, color: "#000" };
}

// End-to-end acceptance for the element-driven engine: for each construction
// type, the classify -> briefsFor -> schedule-reader core must produce the
// correct BESMM element set and measured quantities from the plan alone.
// This is the gate for "accurate take-off for any construction type".

test("BUNGALOW: building/strip/masonry, wall+finish elements, no civil elements", () => {
  const ctx = classifyStructure({
    sheetTitles: ["Ground Floor Plan", "Roof Plan", "Front Elevation"],
    text: "bedroom kitchen living blockwork walls strip foundation door schedule window schedule bungalow",
  });
  assert.equal(ctx.structureClass, "building");
  assert.equal(ctx.buildingType, "bungalow");
  const keys = briefsFor(ctx.structureClass).map((b) => b.key);
  assert.ok(keys.includes("walls") && keys.includes("wall-finishings") && keys.includes("substructure"));
  assert.ok(!keys.includes("pavement") && !keys.includes("deck"));
});

test("50-STOREY TOWER: high-rise/pile/rc-frame, frame+piling elements, BBS -> measured rebar tonnage", () => {
  const ctx = classifyStructure({
    sheetTitles: ["Typical Floor Plan", "Column Schedule", "Pile Layout", "Bar Bending Schedule"],
    text: "50 storey tower reinforced concrete frame column schedule beam schedule bar bending schedule bored pile cap",
  });
  assert.equal(ctx.buildingType, "high-rise");
  assert.equal(ctx.storeys, 50);
  assert.equal(ctx.foundationType, "pile");
  const keys = briefsFor(ctx.structureClass).map((b) => b.key);
  assert.ok(keys.includes("frame") && keys.includes("piling") && keys.includes("pileCaps"));

  const bbs = readBbs(["Bar Bending Schedule", "01 T16 400 12000", "02 T20 200 10000", "03 T25 100 8000"]);
  assert.ok(bbs, "tower BBS must be read");
  const rebar = bbsToItems(bbs!, 4);
  assert.ok(rebar.every((i) => i.unit === "tonnes" && i.confidence === "high"));
  const totalTonnes = rebar.reduce((s, i) => s + i.qty, 0);
  // 16mm 400x12=7.574t + 20mm 200x10=4.932t + 25mm 100x8=3.083t ~= 15.6t
  assert.ok(totalTonnes > 15 && totalTonnes < 16, `tower rebar ~15.6t, got ${totalTonnes}`);

  const piles = readPileSchedule(["Pile Layout Schedule", "P1 900 40 35", "P2 900 30 40"]);
  assert.ok(piles, "tower pile schedule must be read");
  const pileItems = pileScheduleToItems(piles!, 3);
  assert.equal(pileItems.filter((i) => i.unit === "nr").reduce((s, i) => s + i.qty, 0), 70);
});

test("ROAD: road class, pavement+kerbs+earthworks, no building elements", () => {
  const ctx = classifyStructure({
    sheetTitles: ["Road Plan and Longitudinal Section", "Pavement Design"],
    text: "carriageway chainage sub-base road base asphalt wearing course kerb camber cross-fall CBR",
  });
  assert.equal(ctx.structureClass, "road");
  const keys = briefsFor(ctx.structureClass).map((b) => b.key);
  assert.ok(keys.includes("pavement") && keys.includes("kerbsAndDrainage") && keys.includes("earthworks"));
  assert.ok(!keys.includes("walls") && !keys.includes("wall-finishings") && !keys.includes("deck"));

  // civil geometry detector measures paved surface + road length from the plan
  const carriageway = [seg(0, 0, 2000, 0), seg(0, 30, 2000, 30), seg(0, 0, 0, 30), seg(2000, 0, 2000, 30)];
  const civilItems = civilToItems(measureCivil(carriageway, 100), 1);
  const area = civilItems.find((i) => i.unit === "m2");
  const length = civilItems.find((i) => i.unit === "m");
  assert.ok(area && length, "road plan must yield measured paved area + length");
  assert.equal(length!.qty, 200); // 2000pt x 0.1m/pt = 200m
  assert.equal(area!.workSection.code, "2T");
});

test("BRIDGE: bridge class, deck+piling+earthworks, pile schedule -> measured piles", () => {
  const ctx = classifyStructure({
    sheetTitles: ["Bridge General Arrangement", "Deck Slab Details", "Pier Cap", "Pile Schedule"],
    text: "bridge deck slab abutment pier column bearing parapet span girder prestress post-tension pile cap bored pile",
  });
  assert.equal(ctx.structureClass, "bridge");
  assert.equal(ctx.foundationType, "pile");
  const keys = briefsFor(ctx.structureClass).map((b) => b.key);
  assert.ok(keys.includes("deck") && keys.includes("piling") && keys.includes("earthworks"));
  assert.ok(!keys.includes("pavement") && !keys.includes("walls"));

  const piles = readPileSchedule(["Pile Schedule", "P1 1200 8 45", "P2 1200 8 50"]);
  assert.ok(piles, "bridge pile schedule must be read");
  const pileItems = pileScheduleToItems(piles!, 4);
  assert.equal(pileItems.filter((i) => i.unit === "nr").reduce((s, i) => s + i.qty, 0), 16);
  assert.ok(pileItems.every((i) => i.workSection.code === "1.7"));
});

test("AIRPORT: airport class, pavement+earthworks, no building/deck elements", () => {
  const ctx = classifyStructure({
    sheetTitles: ["Runway Layout", "Apron Pavement", "Taxiway Plan"],
    text: "runway taxiway apron airfield aircraft stand PCN pavement concrete slab",
  });
  assert.equal(ctx.structureClass, "airport");
  const keys = briefsFor(ctx.structureClass).map((b) => b.key);
  assert.ok(keys.includes("pavement") && keys.includes("earthworks"));
  assert.ok(!keys.includes("deck") && !keys.includes("walls"));
});

test("REFUSE TO FABRICATE: a building with NO schedules yields no measured rebar/piles", () => {
  const bbs = readBbs(["Ground Floor Plan", "Kitchen", "300x300 column", "Living room"]);
  assert.equal(bbs, null);
  const piles = readPileSchedule(["Ground Floor Plan", "column grid", "beam layout"]);
  assert.equal(piles, null);
});
