import { KpiCard } from "@/components/molecules/kpi-card";
import { formatShortDate } from "@/lib/formatters";
import type { ChangeRequest, ChangeType } from "@/lib/project-types";

/**
 * Where the contract completion date stands once time claims are decided.
 *
 * A change order that wins days is only meaningful against the date it moved,
 * so the register says what that date now is — and shows it only when a claim
 * has actually been awarded, rather than as a permanent empty card.
 */

export type ChangeTypeFilter = "all" | ChangeType;

/** Type is what a QS reads the register by: variations, omissions, time, PC sums. */
export const CHANGE_TYPE_FILTERS: { value: ChangeTypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "variation", label: "Variations" },
  { value: "omission", label: "Omissions" },
  { value: "eot_only", label: "Time claims" },
  { value: "provisional_sum", label: "Provisional sums" },
];

/** Days won (decided claims) and days still sitting with the engineer. */
export function timeClaimDays(items: ChangeRequest[]): { awarded: number; pending: number } {
  let awarded = 0;
  let pending = 0;
  for (const cr of items) {
    if (cr.type !== "eot_only") continue;
    if (cr.status === "Approved" || cr.status === "Executed") awarded += cr.daysAwarded ?? 0;
    else if (cr.status === "Submitted") pending += cr.timeImpactDays;
  }
  return { awarded, pending };
}

interface TimeClaimPositionProps {
  completionDate: string | null;
  revisedCompletionDate: string | null;
  daysAwarded: number;
  daysPending: number;
}

export function TimeClaimPosition({
  completionDate,
  revisedCompletionDate,
  daysAwarded,
  daysPending,
}: TimeClaimPositionProps) {
  const revised = revisedCompletionDate ?? completionDate;

  return (
    <section
      aria-label="Completion position after time claims"
      className="mt-6 grid gap-4 sm:grid-cols-3"
    >
      <KpiCard
        label="Revised completion"
        value={revised ? formatShortDate(revised) : "Not set"}
        helper={
          completionDate && revised !== completionDate
            ? `Contract date ${formatShortDate(completionDate)}`
            : "Moves only on an awarded time claim"
        }
      />
      <KpiCard label="Days awarded" value={daysAwarded} helper="Granted on decided time claims" />
      <KpiCard
        label="Days claimed, undecided"
        value={daysPending}
        helper="Submitted and awaiting a decision"
      />
    </section>
  );
}

TimeClaimPosition.displayName = "TimeClaimPosition";
