import { test } from "node:test";
import assert from "node:assert/strict";
import { briefsFor } from "./besmm-reference.ts";

function keys(structureClass: Parameters<typeof briefsFor>[0]): string[] {
  return briefsFor(structureClass).map((b) => b.key);
}

test("briefsFor(building): includes walls + finishings, excludes pavement/deck", () => {
  const k = keys("building");
  assert.ok(k.includes("walls"));
  assert.ok(k.includes("wall-finishings"));
  assert.ok(k.includes("piling"));
  assert.ok(!k.includes("pavement"));
  assert.ok(!k.includes("deck"));
});

test("briefsFor(road): includes pavement + kerbs + earthworks, excludes walls/finishings", () => {
  const k = keys("road");
  assert.ok(k.includes("pavement"));
  assert.ok(k.includes("kerbsAndDrainage"));
  assert.ok(k.includes("earthworks"));
  assert.ok(!k.includes("walls"));
  assert.ok(!k.includes("wall-finishings"));
  assert.ok(!k.includes("deck"));
});

test("briefsFor(bridge): includes deck + piling + earthworks, excludes pavement/walls", () => {
  const k = keys("bridge");
  assert.ok(k.includes("deck"));
  assert.ok(k.includes("piling"));
  assert.ok(k.includes("pileCaps"));
  assert.ok(k.includes("earthworks"));
  assert.ok(!k.includes("pavement"));
  assert.ok(!k.includes("walls"));
});

test("briefsFor(airport): includes pavement + earthworks, excludes deck/walls", () => {
  const k = keys("airport");
  assert.ok(k.includes("pavement"));
  assert.ok(k.includes("earthworks"));
  assert.ok(!k.includes("deck"));
  assert.ok(!k.includes("walls"));
});

test("briefsFor(unknown): returns the full set (nothing excluded)", () => {
  const k = keys("unknown");
  assert.ok(k.includes("walls"));
  assert.ok(k.includes("pavement"));
  assert.ok(k.includes("deck"));
});

test("every brief has section codes for RAG scoping", () => {
  for (const b of briefsFor("unknown")) {
    assert.ok(b.sectionCodes && b.sectionCodes.length > 0, `brief ${b.key} missing sectionCodes`);
  }
});

test("briefsFor: a single-storey strip-footing building prunes tower elements", () => {
  const keys = briefsFor("building", { storeys: 1, foundationType: "strip" }).map((b) => b.key);
  for (const k of ["upperFloors", "frame", "piling", "pileCaps", "staircases"]) {
    assert.ok(!keys.includes(k), `bungalow should not include ${k}`);
  }
  assert.ok(keys.includes("walls") && keys.includes("substructure") && keys.includes("roof"));
});

test("briefsFor: a piled multi-storey building keeps frame/upperFloors/piling", () => {
  const keys = briefsFor("building", { storeys: 50, foundationType: "pile" }).map((b) => b.key);
  for (const k of ["upperFloors", "frame", "piling", "pileCaps", "staircases"]) {
    assert.ok(keys.includes(k), `tower should include ${k}`);
  }
});
