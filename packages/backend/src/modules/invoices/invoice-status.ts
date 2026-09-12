import { BadRequestError, ConflictError } from "../../lib/errors.ts";
import type { InvoiceStatus, StoredInvoiceStatus } from "./types.ts";

/**
 * The invoice ladder, forward-only, over the stored workflow statuses.
 *
 *   Draft (not billed) → Sent (billed) → Approved → Paid (derived from payments)
 *                          ↕ Queried (a client query holds the ladder)
 *
 * Stored values keep their historical spelling: "Submitted" on disk is "Sent"
 * in the API. Paid / PartiallyPaid / Overdue are derived from payments and the
 * due date, never stored, so they are not transitions.
 */
const FORWARD: Record<StoredInvoiceStatus, StoredInvoiceStatus[]> = {
  Draft: ["Sent"],
  Sent: ["Approved", "Queried"],
  Submitted: ["Approved", "Queried"],
  Queried: ["Sent", "Approved"],
  Approved: [],
};

export function toWorkflowStatus(status: StoredInvoiceStatus | InvoiceStatus | undefined): StoredInvoiceStatus {
  if (status === undefined) return "Draft";
  if (status === "Submitted") return "Sent";
  if (status === "Draft" || status === "Sent" || status === "Approved" || status === "Queried") return status;
  if (status === "Paid" || status === "PartiallyPaid" || status === "Overdue") return "Approved";
  throw new BadRequestError("Invoice status must be Draft, Sent, Queried, or Approved");
}

export function toDatabaseStatus(status: StoredInvoiceStatus): StoredInvoiceStatus {
  return status === "Sent" ? "Submitted" : status;
}

/** What the row may move to next; empty once approved (payments take over). */
export function nextInvoiceStatuses(status: StoredInvoiceStatus | InvoiceStatus): StoredInvoiceStatus[] {
  return [...(FORWARD[toWorkflowStatus(status)] ?? [])];
}

export function assertInvoiceTransition(
  from: StoredInvoiceStatus | InvoiceStatus,
  to: StoredInvoiceStatus | InvoiceStatus,
): void {
  const current = toWorkflowStatus(from);
  const target = toWorkflowStatus(to);
  if (current === target) return;
  if (!FORWARD[current].includes(target)) {
    throw new ConflictError(`Cannot move invoice from ${current} to ${target}`);
  }
}
