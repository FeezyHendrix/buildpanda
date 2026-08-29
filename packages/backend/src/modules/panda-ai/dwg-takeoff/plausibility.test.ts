import { test } from "node:test";
import assert from "node:assert/strict";
import { checkItem, flagImplausibleItems } from "./plausibility.ts";
import type { MeasuredItem } from "./types.ts";

function item(over: Partial<MeasuredItem>): MeasuredItem {
  return {
    trade: "walls",
    description: "d",
    quantity: 100,
    unit: "m2",
    confidence: "medium",
    basis: "b",
    ...over,
  };
}

test("a plausible wall area passes with no flags", () => {
  assert.deepEqual(checkItem(item({ trade: "walls", quantity: 240, unit: "m2" })), []);
});

test("non-positive quantity is flagged", () => {
  assert.ok(checkItem(item({ quantity: 0 })).includes("non_positive_quantity"));
  assert.ok(checkItem(item({ quantity: -5 })).includes("non_positive_quantity"));
});

test("count trade measured in an area unit is a unit mismatch", () => {
  assert.ok(checkItem(item({ trade: "sanitary", unit: "m2", quantity: 3 })).includes("unit_mismatch"));
});

test("linear/area trade measured as a count is a unit mismatch", () => {
  assert.ok(checkItem(item({ trade: "ductwork", unit: "nr", quantity: 10 })).includes("unit_mismatch"));
});

test("order-of-magnitude scale error trips quantity_out_of_band", () => {
  assert.ok(checkItem(item({ unit: "m2", quantity: 4_000_000 })).includes("quantity_out_of_band"));
});

test("unknown unit is flagged", () => {
  assert.ok(checkItem(item({ unit: "widgets", quantity: 5 })).includes("unknown_unit"));
});

test("flagImplausibleItems returns only tripped items", () => {
  const items: MeasuredItem[] = [
    item({ trade: "walls", unit: "m2", quantity: 240 }),
    item({ trade: "sanitary", unit: "m2", quantity: 4 }),
    item({ trade: "walls", unit: "m2", quantity: 0 }),
  ];
  const flagged = flagImplausibleItems(items);
  assert.equal(flagged.length, 2);
  assert.ok(flagged.every((f) => f.flags.length > 0));
});
