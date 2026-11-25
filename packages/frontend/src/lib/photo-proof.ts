/**
 * Photo proof of a real-world money movement (a transfer, a payment). It is a
 * JPG or PNG up to 10MB. The forms that offer it validate and hold the file,
 * but the API does not take it yet — see docs/finance-overview-backend.md and
 * docs/expenses-backend.md.
 */
export const PROOF_ACCEPT = "image/jpeg,image/png";
const PROOF_TYPES = ["image/jpeg", "image/png"];
const PROOF_MAX_BYTES = 10 * 1024 * 1024;

/** Returns an error message, or null when the file is an acceptable proof. */
export function proofError(file: File): string | null {
  if (!PROOF_TYPES.includes(file.type)) return "Proof must be a JPG or PNG image.";
  if (file.size > PROOF_MAX_BYTES) return "Proof must be 10MB or smaller.";
  return null;
}
