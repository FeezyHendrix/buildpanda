import { test } from "node:test";
import assert from "node:assert/strict";
import { assertInvoiceTransition, nextInvoiceStatuses, toWorkflowStatus } from "./invoice-status.ts";

test("the ladder is forward-only: Draft → Sent → Approved, with Queried as the hold state", () => {
  assert.deepEqual(nextInvoiceStatuses("Draft"), ["Sent"]);
  assert.deepEqual(nextInvoiceStatuses("Sent"), ["Approved", "Queried"]);
  // Stored spelling of Sent reads the same rung.
  assert.deepEqual(nextInvoiceStatuses("Submitted"), ["Approved", "Queried"]);
  assert.deepEqual(nextInvoiceStatuses("Queried"), ["Sent", "Approved"]);
  assert.deepEqual(nextInvoiceStatuses("Approved"), []);
  // Derived payment states sit on the Approved rung.
  assert.deepEqual(nextInvoiceStatuses("Paid"), []);
  assert.deepEqual(nextInvoiceStatuses("Overdue"), []);
});

test("assertInvoiceTransition allows forward moves and the same rung, rejects the rest", () => {
  assert.doesNotThrow(() => assertInvoiceTransition("Draft", "Sent"));
  assert.doesNotThrow(() => assertInvoiceTransition("Submitted", "Approved"));
  assert.doesNotThrow(() => assertInvoiceTransition("Sent", "Queried"));
  assert.doesNotThrow(() => assertInvoiceTransition("Queried", "Sent"));
  assert.doesNotThrow(() => assertInvoiceTransition("Sent", "Submitted"));
  assert.throws(() => assertInvoiceTransition("Approved", "Draft"), /Cannot move invoice from Approved to Draft/);
  assert.throws(() => assertInvoiceTransition("Sent", "Draft"), /Cannot move invoice from Sent to Draft/);
  assert.throws(() => assertInvoiceTransition("Draft", "Approved"), /Cannot move invoice from Draft to Approved/);
});

test("toWorkflowStatus keeps every stored value and rejects unknown ones", () => {
  assert.equal(toWorkflowStatus(undefined), "Draft");
  assert.equal(toWorkflowStatus("Submitted"), "Sent");
  assert.equal(toWorkflowStatus("Queried"), "Queried");
  assert.equal(toWorkflowStatus("PartiallyPaid"), "Approved");
  assert.throws(() => toWorkflowStatus("Bogus" as never), /Invoice status must be/);
});
