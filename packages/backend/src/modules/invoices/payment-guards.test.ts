import { test } from "node:test";
import assert from "node:assert/strict";
import { assertDeletable, assertPaymentAllowed } from "./payment-guards.ts";
import type { AddPaymentInput, InvoiceRow } from "./types.ts";

function row(over: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    status: "Approved",
    due_date: "2026-09-22",
    voided_at: null,
    number: "IS2-IPC-001",
    ...over,
  } as unknown as InvoiceRow;
}

const TODAY = "2026-09-13";

function pay(over: Partial<AddPaymentInput> = {}): AddPaymentInput {
  return { amount: 1_000, ...over };
}

test("a payment is refused on an invoice that was never issued", () => {
  assert.throws(
    () => assertPaymentAllowed({ ...row(), status: "Draft" }, pay(), 1_000, TODAY),
    /not been issued/i,
  );
});

test("a payment is refused on an issued but uncertified invoice", () => {
  assert.throws(
    () => assertPaymentAllowed({ ...row(), status: "Submitted" }, pay(), 1_000, TODAY),
    /must be approved/i,
  );
  assert.throws(
    () => assertPaymentAllowed({ ...row(), status: "Queried" }, pay(), 1_000, TODAY),
    /must be approved/i,
  );
});

test("a receipt cannot be dated in the future — it has not happened", () => {
  assert.throws(
    () => assertPaymentAllowed(row(), pay({ paidAt: "2026-10-03" }), 5_000, TODAY),
    /cannot be dated in the future/i,
  );
  // Today itself is fine.
  assert.doesNotThrow(() => assertPaymentAllowed(row(), pay({ paidAt: TODAY }), 5_000, TODAY));
});

test("paying more than the balance is refused unless the overpayment is intended", () => {
  assert.throws(
    () => assertPaymentAllowed(row(), pay({ amount: 90_000 }), 85_000, TODAY),
    /exceeds the 85000.00 outstanding/,
  );
  // Accepting it needs a note saying what it is…
  assert.throws(
    () => assertPaymentAllowed(row(), pay({ amount: 90_000, allowOverpayment: true }), 85_000, TODAY),
    /needs a note/i,
  );
  // …and is then recorded as a credit, never as a receipt against the balance.
  const guard = assertPaymentAllowed(
    row(),
    pay({ amount: 90_000, allowOverpayment: true, note: "Employer paid IPC-002 early" }),
    85_000,
    TODAY,
  );
  assert.equal(guard.credit, true);
});

test("a second payment against a cleared invoice is an overpayment, not a negative balance", () => {
  assert.throws(
    () => assertPaymentAllowed(row(), pay({ amount: 1_000_000 }), 0, TODAY),
    /exceeds the 0.00 outstanding/,
  );
});

test("a payment within the balance is allowed and is not a credit", () => {
  const guard = assertPaymentAllowed(row(), pay({ amount: 85_000 }), 85_000, TODAY);
  assert.equal(guard.credit, false);
});

test("nothing lands on a voided certificate", () => {
  assert.throws(
    () => assertPaymentAllowed({ ...row(), voided_at: "2026-09-12" }, pay(), 5_000, TODAY),
    /voided/i,
  );
});

test("an invoice carrying payments is voided, never deleted", () => {
  assert.throws(() => assertDeletable(row(), 1), /void it with a reason instead of deleting/i);
  assert.doesNotThrow(() => assertDeletable(row(), 0));
  assert.throws(() => assertDeletable({ ...row(), voided_at: "2026-09-12" }, 0), /already voided/i);
});
