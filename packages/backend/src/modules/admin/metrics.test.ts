import { test } from "node:test";
import assert from "node:assert/strict";
import { priorRange, deltaPct, funnelConversions } from "./metrics-repository.ts";

test("priorRange mirrors the current window immediately before it", () => {
  const range = { from: new Date("2026-01-08T00:00:00Z"), to: new Date("2026-01-15T00:00:00Z") };
  const prior = priorRange(range);
  assert.equal(prior.to.toISOString(), range.from.toISOString());
  assert.equal(prior.from.toISOString(), new Date("2026-01-01T00:00:00Z").toISOString());
});

test("deltaPct handles zero baseline without dividing by zero", () => {
  assert.equal(deltaPct(0, 0), 0);
  assert.equal(deltaPct(5, 0), 100);
  assert.equal(deltaPct(150, 100), 50);
  assert.equal(deltaPct(50, 100), -50);
});

test("funnelConversions computes per-step conversion off the previous step", () => {
  const result = funnelConversions([
    { step: "Signed up", value: 100 },
    { step: "Joined org", value: 80 },
    { step: "Created proposal", value: 40 },
    { step: "Ran take-off", value: 0 },
  ]);
  assert.equal(result[0]!.conversionPct, 100);
  assert.equal(result[1]!.conversionPct, 80);
  assert.equal(result[2]!.conversionPct, 50);
  assert.equal(result[3]!.conversionPct, 0);
});

test("funnelConversions is safe when a step has zero upstream", () => {
  const result = funnelConversions([
    { step: "a", value: 0 },
    { step: "b", value: 0 },
  ]);
  assert.equal(result[0]!.conversionPct, 100);
  assert.equal(result[1]!.conversionPct, 0);
});
