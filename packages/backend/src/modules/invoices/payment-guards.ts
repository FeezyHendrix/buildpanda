import { BadRequestError, ConflictError } from "../../lib/errors.ts";
import { Money } from "../../lib/money.ts";
import { toWorkflowStatus } from "./invoice-status.ts";
import type { AddPaymentInput, InvoiceRow, StoredInvoiceStatus } from "./types.ts";

/**
 * What a recorded payment is allowed to be.
 *
 * A payment here is a LOG of money a human moved off-platform, so the guards
 * are the ones a QS would apply to a receipt book, not to a payment gateway:
 *   • nothing can be received against a certificate that was never issued or
 *     certified — an unissued invoice has no sum owing;
 *   • a receipt cannot be dated in the future, because it has not happened;
 *   • paying more than the balance is accepted only when the user says so, and
 *     is then recorded as a CREDIT with a note rather than driving the balance
 *     negative;
 *   • nothing at all lands on a voided certificate.
 */

/** Statuses a payment may be recorded against: certified, or already part-paid. */
const PAYABLE_FROM: ReadonlySet<StoredInvoiceStatus> = new Set<StoredInvoiceStatus>(["Approved"]);

export interface PaymentGuardResult {
  /** True when the payment exceeds the balance and the caller accepted that. */
  credit: boolean;
}

export function assertPaymentAllowed(
  row: InvoiceRow,
  input: AddPaymentInput,
  balanceDue: number,
  today = new Date().toISOString().slice(0, 10),
): PaymentGuardResult {
  if (row.voided_at) {
    throw new ConflictError("This certificate was voided — record the payment on its replacement");
  }
  if (input.amount <= 0) {
    throw new BadRequestError("Payment amount must be positive");
  }

  const status = toWorkflowStatus(row.status);
  if (!PAYABLE_FROM.has(status)) {
    throw new ConflictError(
      status === "Draft"
        ? "This invoice has not been issued — send and certify it before recording a payment"
        : `This invoice is ${status} — it must be approved before a payment is recorded against it`,
    );
  }

  if (input.paidAt) {
    const paidAt = String(input.paidAt).slice(0, 10);
    if (paidAt > today) {
      throw new BadRequestError("A recorded receipt cannot be dated in the future");
    }
  }

  const over = Money.of(input.amount).gt(Money.of(balanceDue).round(2));
  if (over && !input.allowOverpayment) {
    throw new ConflictError(
      `Payment exceeds the ${Money.of(balanceDue).round(2).toFixed(2)} outstanding on this invoice — record it as an overpayment if that is intended`,
    );
  }
  if (over && !input.note?.trim()) {
    throw new BadRequestError("An overpayment needs a note explaining it");
  }

  return { credit: over };
}

/** A certificate with money recorded against it is voided, never deleted. */
export function assertDeletable(row: InvoiceRow, paymentCount: number): void {
  if (paymentCount > 0) {
    throw new ConflictError(
      "Payments are recorded against this invoice — void it with a reason instead of deleting it",
    );
  }
  if (row.voided_at) {
    throw new ConflictError("This invoice is already voided");
  }
}
