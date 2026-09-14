import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRate, priceRow } from "./price.ts";
import type { PreconRateRow } from "../types.ts";

const rate = (overrides: Partial<PreconRateRow>): PreconRateRow => ({
  id: "prt_1",
  rate_card_id: "prc_1",
  code_prefix: null,
  description_pattern: null,
  unit: "m2",
  rate: 12000,
  created_at: new Date("2026-07-12T00:00:00Z"),
  ...overrides,
});

test("matchRate: unit must match", () => {
  const rates = [rate({ unit: "m2", description_pattern: "blockwork" })];
  assert.equal(matchRate({ code: "F10/125", description: "225mm blockwork", unit: "m", qty: 10 }, rates), null);
  assert.ok(matchRate({ code: "F10/125", description: "225mm blockwork", unit: "m2", qty: 10 }, rates));
});

test("matchRate: code prefix narrows, description similarity breaks ties", () => {
  const blockwork = rate({ id: "prt_bw", code_prefix: "F10", description_pattern: "sandcrete blockwork" });
  const screed = rate({ id: "prt_sc", code_prefix: "M10", description_pattern: "cement sand screed" });
  const generic = rate({ id: "prt_gen", description_pattern: "sandcrete blockwork cement mortar" });
  const row = { code: "F10/125", description: "225mm hollow sandcrete blockwork in cement mortar", unit: "m2", qty: 46.2 };
  const matched = matchRate(row, [screed, generic, blockwork]);
  assert.ok(matched);
  assert.notEqual(matched.id, "prt_sc"); // wrong code prefix excluded
});

test("matchRate: no signal means no match — QS prices manually", () => {
  const rates = [rate({ code_prefix: null, description_pattern: null })];
  assert.equal(matchRate({ code: "F10/125", description: "blockwork", unit: "m2", qty: 1 }, rates), null);
});

test("priceRow computes amount from qty", () => {
  const rates = [rate({ description_pattern: "sandcrete blockwork", rate: 12000 })];
  const priced = priceRow({ code: null, description: "225mm sandcrete blockwork", unit: "m2", qty: 46.2 }, rates, "Abuja Q3");
  assert.ok(priced);
  assert.equal(priced.rate, 12000);
  assert.equal(priced.amount, 554400);
  assert.equal(priced.rate_source, "Abuja Q3");
});
