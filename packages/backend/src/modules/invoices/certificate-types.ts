/**
 * An invoice as a CERTIFICATE: which way it points, the trail of who moved it
 * and why, and the previous / this / cumulative structure a QS reads down.
 */

export const INVOICE_DIRECTIONS = ["payable", "receivable"] as const;
export type InvoiceDirection = (typeof INVOICE_DIRECTIONS)[number];

export const INVOICE_EVENT_TYPES = [
  "created",
  "sent",
  "queried",
  "approved",
  "voided",
  "payment_recorded",
  "payment_removed",
] as const;
export type InvoiceEventType = (typeof INVOICE_EVENT_TYPES)[number];

/** One status change on the certificate: who, when, and why. */
export interface InvoiceEvent {
  id: string;
  type: InvoiceEventType;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  actor: { id: string | null; name: string };
  amount: number | null;
  createdAt: string;
}

export interface InvoiceEventRow {
  id: string;
  invoice_id: string;
  project_id: string;
  type: InvoiceEventType;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  actor_id: string | null;
  actor_name: string;
  amount: string | null;
  created_at: Date | string;
}

export interface NewInvoiceEventRecord {
  id: string;
  invoice_id: string;
  project_id: string;
  type: InvoiceEventType;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  actor_id: string | null;
  actor_name: string;
  amount: string | null;
}

/**
 * The interim-certificate structure a QS reads down: what was certified
 * before, what this certificate adds, and where that leaves the cumulative
 * position — with the deductions taken on this certificate.
 */
export interface InvoiceCertificate {
  /** 1 for IPC 1, 2 for IPC 2 …, counted over receivable progress certificates. */
  number: number;
  previousCertified: number;
  thisCertificate: number;
  cumulative: number;
  retention: number;
  vat: number;
  advanceRecovery: number;
  netPayable: number;
}
