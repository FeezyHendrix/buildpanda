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
