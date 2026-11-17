import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestError } from "../../lib/errors.ts";
import { MessagingClarificationError } from "./draft-errors.ts";
import type { MessagingReviewAction } from "./management-types.ts";
import { materialReviewCommand } from "./material-review.ts";

const scope = { organizationId: "company", projectId: "site", buildingId: null };
const movement = { entryType: "IN", materialName: "Sand", quantity: 12, unit: "m³" };
const action = (payload: Record<string, unknown>): MessagingReviewAction => ({ kind: "material_log", title: "Material log", payload });

test("material receipts and usage keep canonical positive quantities and plain-note mirrors", () => {
  const input = { ...movement, reason: "Expected last week.\n\nArrived with <delivery> note.", supplier: "Site supplier", deliveryNote: "DN-12", locationKey: "East store" };
  const before = structuredClone(input), command = materialReviewCommand(action(input), scope);
  assert.equal(command.kind, "material_log"); assert.equal(command.projectId, scope.projectId);
  assert.deepEqual(input, before); assert.equal(command.payload.quantity, 12); assert.equal(command.payload.reason, input.reason);
  assert.equal(command.payload.notesHtml, "<p>Expected last week.<br /><br />Arrived with &lt;delivery&gt; note.</p>");
  assert.equal(command.payload.locationKey, "East store");
  for (const key of ["buildingId", "logDate", "approvalStatus", "idempotencyKey", "occurredAt"]) assert.equal(Object.hasOwn(command.payload, key), false);
  assert.equal(materialReviewCommand(action({ ...movement, entryType: "USED" }), scope).payload.quantity, 12);
});

test("missing material, quantity, direction and unit ask clear questions rather than inventing stock", () => {
  for (const [patch, expected] of [[{ materialName: null }, /material name/], [{ quantity: null }, /quantity/],
    [{ unit: "" }, /unit/], [{ entryType: null }, /arrived or was used/]] as const) {
    assert.throws(() => materialReviewCommand(action({ ...movement, ...patch }), scope), (error: unknown) => {
      assert.ok(error instanceof MessagingClarificationError); assert.match(error.message, expected); return true;
    });
  }
  for (const quantity of [0, -12, NaN, Infinity, "some"]) {
    assert.throws(() => materialReviewCommand(action({ ...movement, quantity }), scope), MessagingClarificationError);
  }
});

test("material model fields cannot choose a project, building, approval, linked record, file or idempotency key", () => {
  for (const key of ["projectId", "buildingId", "stageId", "materialOrderId", "taskId", "activityId", "fileIds", "approvalStatus", "idempotencyKey", "logDate"]) {
    assert.throws(() => materialReviewCommand(action({ ...movement, [key]: "foreign" }), scope), BadRequestError);
  }
  assert.throws(() => materialReviewCommand(action({ ...movement, reason: "[Photo](/files/guessed/download)" }), scope), BadRequestError);
});

test("material quantities respect ledger precision without rounding or guessing a unit conversion", () => {
  for (const quantity of [0.12, 999999999999.99]) {
    const input = { ...movement, quantity };
    assert.equal(materialReviewCommand(action(input), scope).payload.quantity, quantity);
    assert.equal(input.quantity, quantity);
  }
  const input = { ...movement, quantity: 0.125 };
  assert.throws(() => materialReviewCommand(action(input), scope), (error: unknown) => {
    assert.ok(error instanceof MessagingClarificationError);
    assert.match(error.message, /two decimal places/);
    assert.match(error.message, /not guess a conversion/);
    return true;
  });
  assert.equal(input.quantity, 0.125);
  assert.equal(input.unit, movement.unit);
  assert.throws(() => materialReviewCommand(action({ ...movement, quantity: 1000000000000 }), scope), MessagingClarificationError);
});

test("material fields retain canonical length limits and only a safe generated HTML mirror", () => {
  for (const [field, max] of [["materialName", 200], ["unit", 40], ["reason", 1000], ["supplier", 200], ["deliveryNote", 120], ["locationKey", 100]] as const) {
    materialReviewCommand(action({ ...movement, [field]: "x".repeat(max) }), scope);
    assert.throws(() => materialReviewCommand(action({ ...movement, [field]: "x".repeat(max + 1) }), scope), BadRequestError);
  }
  assert.throws(() => materialReviewCommand(action({ ...movement, entryType: "VOID" }), scope), BadRequestError);
  const first = materialReviewCommand(action({ ...movement, reason: "Late delivery" }), scope);
  assert.deepEqual(materialReviewCommand(action({ ...first.payload }), scope), first);
  assert.throws(() => materialReviewCommand(action({ ...movement, reason: "Late delivery", notesHtml: "<strong>Late delivery</strong>" }), scope), BadRequestError);
});

test("actual occurrence is validated separately from an expected delivery date", () => {
  for (const occurredAt of ["2026-11-16", "2026-11-16T12:17:40+01:00", null]) {
    assert.equal(materialReviewCommand(action({ ...movement, occurredAt }), scope).payload.occurredAt, occurredAt);
  }
  for (const occurredAt of ["last week", "2026-02-30", "2026-11-16T25:00:00Z"]) {
    assert.throws(() => materialReviewCommand(action({ ...movement, occurredAt }), scope), MessagingClarificationError);
  }
  assert.equal(materialReviewCommand(action({ ...movement, reason: "Was supposed to arrive last week" }), scope).payload.occurredAt, undefined);
});
