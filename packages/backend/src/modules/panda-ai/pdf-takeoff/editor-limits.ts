// How much work one editor operation is allowed to be.
//
// Both caps exist to make an over-large operation fail cleanly rather than
// half-commit: they are checked against the work the operation WOULD do,
// before any mutation, so exceeding one changes no state at all.

import { PayloadTooLargeError } from "../../../lib/errors.ts";
import { DERIVED_BASIS_PATTERN } from "./engine/enrich.ts";
import type { PreconBoqRowRow } from "./types.ts";

export const DERIVED_ROW_LIMIT = 1000;

export const AUDIT_PAYLOAD_LIMIT_BYTES = 8 * 1024 * 1024;

export function derivedRowsIn(rows: PreconBoqRowRow[]): PreconBoqRowRow[] {
  return rows.filter((row) => row.status !== "rejected" && DERIVED_BASIS_PATTERN.test(row.measurement_basis ?? ""));
}

export function assertDerivedFanout(count: number): void {
  if (count > DERIVED_ROW_LIMIT) {
    throw new PayloadTooLargeError(
      `Operation exceeds derived-row limit: ${count} rows affected (max ${DERIVED_ROW_LIMIT}). The bill is too large for automatic recomputation.`,
    );
  }
}

export function assertAuditPayloadWithinCap(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): void {
  const bytes = Buffer.byteLength(JSON.stringify({ before, after }), "utf8");
  if (bytes > AUDIT_PAYLOAD_LIMIT_BYTES) {
    throw new PayloadTooLargeError(
      `Operation exceeds audit-size limit: ${bytes} bytes of before/after state (max ${AUDIT_PAYLOAD_LIMIT_BYTES}). Split the change into smaller saves.`,
    );
  }
}
