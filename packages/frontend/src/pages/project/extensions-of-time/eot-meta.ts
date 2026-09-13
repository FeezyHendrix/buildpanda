import type { BadgeTone } from "@/components/atoms/badge";
import type { EotStatus } from "@/api/extensions-of-time";
import type { Activity, ActivityDelay } from "@/lib/project-types";

/** Status carries a glyph as well as a tone, so it never reads by colour alone. */
export const EOT_STATUS_META: Record<EotStatus, { label: string; tone: BadgeTone; glyph: string }> = {
  Draft: { label: "Draft", tone: "neutral", glyph: "○" },
  Submitted: { label: "Submitted", tone: "warning", glyph: "◷" },
  Approved: { label: "Approved", tone: "success", glyph: "✓" },
  Rejected: { label: "Rejected", tone: "danger", glyph: "✕" },
};

export type EotStatusFilter = "all" | EotStatus;

export const EOT_STATUS_FILTERS: { value: EotStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Draft", label: "Draft" },
  { value: "Submitted", label: "Submitted" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

/** One delay a claim may cite, with the activity it stopped. */
export interface ClaimableDelay {
  delay: ActivityDelay;
  activityName: string;
}

/**
 * Only a client-culpable or neutral delay buys time back; the server rejects a
 * claim that cites a contractor's own breakdown, naming it. Offering only the
 * claimable ones is what stops a PM writing a claim that cannot be argued.
 */
export function claimableDelays(activities: Activity[]): ClaimableDelay[] {
  return activities.flatMap((activity) =>
    activity.delays
      .filter((delay) => delay.eotClaimable)
      .map((delay) => ({ delay, activityName: activity.name })),
  );
}

export function totalDaysLost(delays: ClaimableDelay[], selectedIds: ReadonlySet<string>): number {
  return delays.reduce((sum, d) => (selectedIds.has(d.delay.id) ? sum + d.delay.daysLost : sum), 0);
}
