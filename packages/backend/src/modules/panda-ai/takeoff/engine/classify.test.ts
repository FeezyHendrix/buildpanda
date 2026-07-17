import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyStructure } from "./classify.ts";

test("classifyStructure: bungalow floor plan -> building/bungalow/strip/masonry", () => {
  const ctx = classifyStructure({
    sheetTitles: ["Ground Floor Plan", "Roof Plan", "Front Elevation"],
    text: "bedroom kitchen living room blockwork walls strip foundation door schedule window schedule bungalow",
  });
  assert.equal(ctx.structureClass, "building");
  assert.equal(ctx.buildingType, "bungalow");
  assert.equal(ctx.foundationType, "strip");
  assert.equal(ctx.structuralSystem, "load-bearing-masonry");
});

test("classifyStructure: 50-storey tower -> building/high-rise/pile/rc-frame", () => {
  const ctx = classifyStructure({
    sheetTitles: ["Typical Floor Plan", "Column Schedule", "Pile Layout"],
    text: "50 storey tower reinforced concrete frame column schedule beam schedule bar bending schedule bored pile cap",
  });
  assert.equal(ctx.structureClass, "building");
  assert.equal(ctx.buildingType, "high-rise");
  assert.equal(ctx.storeys, 50);
  assert.equal(ctx.structuralSystem, "reinforced-concrete-frame");
  assert.equal(ctx.foundationType, "pile");
});

test("classifyStructure: road plan -> road", () => {
  const ctx = classifyStructure({
    sheetTitles: ["Road Plan and Longitudinal Section", "Pavement Design"],
    text: "carriageway chainage sub-base road base asphalt wearing course kerb camber cross-fall CBR",
  });
  assert.equal(ctx.structureClass, "road");
  assert.equal(ctx.buildingType, null);
});

test("classifyStructure: bridge -> bridge/pile", () => {
  const ctx = classifyStructure({
    sheetTitles: ["Bridge General Arrangement", "Deck Slab Details", "Pier Cap"],
    text: "bridge deck slab abutment pier column bearing parapet span girder prestress post-tension pile cap bored pile",
  });
  assert.equal(ctx.structureClass, "bridge");
  assert.equal(ctx.foundationType, "pile");
});

test("classifyStructure: airport apron -> airport", () => {
  const ctx = classifyStructure({
    sheetTitles: ["Runway Layout", "Apron Pavement"],
    text: "runway taxiway apron airfield aircraft stand PCN pavement concrete slab",
  });
  assert.equal(ctx.structureClass, "airport");
});

test("classifyStructure: empty/ambiguous -> unknown low confidence", () => {
  const ctx = classifyStructure({ sheetTitles: ["Sheet 1"], text: "notes general" });
  assert.equal(ctx.structureClass, "unknown");
  assert.equal(ctx.confidence, "low");
});

// Regression (AUC Building A): floor plans up to Eighth Floor; elevations label a
// 9th-floor ROOF datum + repeat every level. Must count 9 (Ground+1st..8th), not
// 19/43 from summing repeated labels.
test("classifyStructure: repeated floor labels across elevations do NOT inflate storeys", () => {
  const kinds = { plan: "floor-plan" as const, elev: "elevation" as const };
  const sheets = [
    { kind: kinds.plan, title: "Third Basement Floor Plan" },
    { kind: kinds.plan, title: "Ground Floor Plan" },
    { kind: kinds.plan, title: "First Floor Plan" },
    { kind: kinds.plan, title: "Fourth Floor Plan" },
    { kind: kinds.plan, title: "Eighth Floor Plan" },
    { kind: kinds.elev, title: "Front Side Elevation" },
    { kind: kinds.elev, title: "Rear Side Elevation" },
    { kind: kinds.elev, title: "Left Side Elevation" },
  ];
  const text =
    "9th FLOOR 8th FLOOR 7th FLOOR 6th FLOOR 5th FLOOR 4th FLOOR 3rd FLOOR 2nd FLOOR 1st FLOOR GROUND FLOOR " +
    "1 BASEMENT 2 BASEMENT 3rd BASEMENT 1st FLOOR 2nd FLOOR 3rd FLOOR 4th FLOOR 5th FLOOR 6th FLOOR 7th FLOOR 8th FLOOR 9th FLOOR " +
    "blockwork office pool office window schedule door schedule";
  const ctx = classifyStructure({ sheetTitles: sheets.map((s) => s.title), sheets, text });
  assert.equal(ctx.structureClass, "building");
  assert.equal(ctx.storeys, 9);
});

test("classifyStructure: explicit 'G+N' statement counts storeys when plans are shared", () => {
  const ctx = classifyStructure({
    sheetTitles: ["Typical Floor Plan"],
    sheets: [{ kind: "floor-plan", title: "Typical Floor Plan" }],
    text: "proposed G+11 office building reinforced concrete frame column schedule",
  });
  assert.equal(ctx.storeys, 12);
});

test("classifyStructure: bungalow single floor plan -> 1 storey", () => {
  const ctx = classifyStructure({
    sheetTitles: ["Ground Floor Plan", "Roof Plan"],
    sheets: [
      { kind: "floor-plan", title: "Ground Floor Plan" },
      { kind: "floor-plan", title: "Roof Plan" },
    ],
    text: "bungalow blockwork strip foundation bedroom kitchen living",
  });
  assert.equal(ctx.storeys, 1);
});

test("classifyStructure: 'Level N' naming counts storeys (Level 12 -> 13)", () => {
  const sheets = [
    { kind: "floor-plan" as const, title: "Level 00 Plan" },
    { kind: "floor-plan" as const, title: "Level 05 Plan" },
    { kind: "floor-plan" as const, title: "Level 12 Plan" },
  ];
  const ctx = classifyStructure({
    sheetTitles: sheets.map((s) => s.title),
    sheets,
    text: "level plan office pool office corridor blockwork bedroom kitchen window schedule",
  });
  assert.equal(ctx.structureClass, "building");
  assert.equal(ctx.storeys, 13);
});

test("classifyStructure: mezzanine counts as an extra storey", () => {
  const sheets = [
    { kind: "floor-plan" as const, title: "Ground Floor Plan" },
    { kind: "floor-plan" as const, title: "Mezzanine Floor Plan" },
    { kind: "floor-plan" as const, title: "First Floor Plan" },
  ];
  const ctx = classifyStructure({
    sheetTitles: sheets.map((s) => s.title),
    sheets,
    text: "ground mezzanine first floor plan office blockwork bedroom kitchen window schedule",
  });
  assert.equal(ctx.storeys, 3);
});

test("classifyStructure: ordinal floor without the word 'Plan' still counts", () => {
  const sheets = [
    { kind: "floor-plan" as const, title: "Third Floor" },
    { kind: "floor-plan" as const, title: "Eighth Floor" },
  ];
  const ctx = classifyStructure({
    sheetTitles: sheets.map((s) => s.title),
    sheets,
    text: "third floor eighth floor office pool office blockwork bedroom kitchen window schedule door schedule",
  });
  assert.equal(ctx.storeys, 9);
});
