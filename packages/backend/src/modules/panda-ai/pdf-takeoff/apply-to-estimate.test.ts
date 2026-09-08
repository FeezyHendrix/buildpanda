import { test } from "node:test";
import assert from "node:assert/strict";
import { diffTakeoffAgainstEstimate, itemsToWrite } from "./apply-to-estimate.ts";
import type { PreconBill, PreconBoqRowDto } from "./types.ts";
import type { EstimateItem } from "../../proposals/types.ts";

const bills: PreconBill[] = [{ id: "pbl_1", title: "Bill No. 2 — Measured works", sort: 1 }];

function row(overrides: Partial<PreconBoqRowDto>): PreconBoqRowDto {
  return {
    id: "pbr_x",
    billId: "pbl_1",
    sort: 0,
    rowType: "item",
    elementGroup: "Walls",
    code: "F10",
    description: "225mm blockwork",
    unit: "m2",
    qtyGross: 50,
    deductions: [],
    qty: 46.2,
    rate: null,
    amount: null,
    rateSource: null,
    confidence: "high",
    status: "verified",
    version: 1,
    measurementBasis: null,
    verifiedBy: null,
    verifiedAt: null,
    confidenceReason: null,
    provenance: null,
    origin: "ai",
    editedAt: null,
    editedBy: null,
    ...overrides,
  };
}

function item(overrides: Partial<EstimateItem>): EstimateItem {
  return {
    id: "item_x",
    estimateId: "est_1",
    groupLabel: "Walls",
    description: "225mm blockwork",
    descriptionHtml: null,
    qty: 46.2,
    unit: "m2",
    unitRate: 12000,
    total: 554400,
    boqItemId: null,
    takeoffSessionId: null,
    sort: 0,
    ...overrides,
  };
}

test("first apply adds every priceable, non-rejected line and skips headings", () => {
  const rows = [
    row({ id: "pbr_1" }),
    row({ id: "pbr_2", rowType: "heading", description: "WALLS" }),
    row({ id: "pbr_3", status: "rejected" }),
    row({ id: "pbr_4", rowType: "provisional_sum", description: "Kitchen fittings", unit: "sum", qty: 1 }),
  ];
  const preview = diffTakeoffAgainstEstimate("pcs_1", bills, rows, []);
  assert.equal(preview.added, 2);
  assert.equal(preview.removed, 0);
  assert.deepEqual(
    preview.items.map((i) => i.boqItemId),
    ["pbr_1", "pbr_4"],
  );
  assert.equal(preview.items[0]?.takeoffSessionId, "pcs_1");
});

test("re-apply keeps the estimator's rate, flags changed quantities, removes dropped lines, leaves hand-entered items", () => {
  const rows = [row({ id: "pbr_1", qty: 50 }), row({ id: "pbr_2", description: "Screed", unit: "m2", qty: 30 })];
  const existing = [
    item({ id: "item_1", boqItemId: "pbr_1", takeoffSessionId: "pcs_1", qty: 46.2, unitRate: 12000 }),
    item({ id: "item_2", boqItemId: "pbr_9", takeoffSessionId: "pcs_1", description: "Old line", qty: 1 }),
    item({ id: "item_3", boqItemId: null, description: "Skirting, by hand", qty: 42, unit: "m", unitRate: 2100 }),
    item({ id: "item_4", boqItemId: "pbr_other", takeoffSessionId: "pcs_2", description: "From another take-off" }),
  ];
  const preview = diffTakeoffAgainstEstimate("pcs_1", bills, rows, existing);
  assert.equal(preview.changed, 1);
  assert.equal(preview.added, 1);
  assert.equal(preview.removed, 1);
  assert.equal(preview.unchanged, 2);
  const changed = preview.items.find((i) => i.boqItemId === "pbr_1");
  assert.equal(changed?.unitRate, 12000, "rate is kept from the estimate");
  assert.equal(changed?.qty, 50);
  assert.deepEqual(changed?.previous, { qty: 46.2, unit: "m2", description: "225mm blockwork" });
  const written = itemsToWrite(preview);
  assert.equal(written.length, 4);
  assert.ok(written.every((w, i) => w.sort === i));
  assert.ok(!written.some((w) => w.boqItemId === "pbr_9"), "removed line is not written");
  assert.ok(written.some((w) => w.description === "Skirting, by hand"), "hand-entered item survives");
});
