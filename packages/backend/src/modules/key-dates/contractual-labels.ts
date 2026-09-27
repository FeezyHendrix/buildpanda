/**
 * Which key dates the contract fixes.
 *
 * A contractual key date carries liquidated-damages consequences and moves only
 * when an extension of time is awarded — and then every one of them moves
 * together with the revised completion date. The flag arrived after these dates
 * were already being entered, and it defaults to false, so "Practical
 * completion" ended up flagged by hand while "Defects liability ends" did not:
 * one award moved the project date and Practical completion and left defects
 * liability where it was.
 *
 * Naming them here means a date the contract plainly owns is contractual the
 * moment it is created, and the same list can put the existing records right.
 * The operator can still override the flag either way on the record itself.
 *
 * Only completion-side dates belong here. Site possession and the commencement
 * date are contractual in the ordinary sense but an extension of time does not
 * move them — it extends the time for completion, it does not restart the job —
 * and in this schema `is_contractual` is precisely "moves with an award".
 */

/** Matched case-insensitively against the key date's label. */
export const CONTRACTUAL_LABEL_PATTERNS = [
  "practical completion",
  "substantial completion",
  "sectional completion",
  "completion date",
  "contract completion",
  "defects liability",
  "defects notification",
  "making good defects",
  "final certificate",
  "final account",
  "date for completion",
  "taking over",
] as const;

export function isContractualLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  const normalised = label.toLowerCase();
  return CONTRACTUAL_LABEL_PATTERNS.some((pattern) => normalised.includes(pattern));
}
