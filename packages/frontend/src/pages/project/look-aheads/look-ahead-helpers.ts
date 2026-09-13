import type { BadgeTone } from "@/components/atoms/badge";
import type { LookAheadStatus } from "@/lib/project-types";

export const LOOK_AHEAD_STATUS_META: Record<LookAheadStatus, { label: string; tone: BadgeTone }> = {
  Draft: { label: "Draft", tone: "neutral" },
  UnderReview: { label: "Under review", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
};

export function formatLookAheadDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Activity ids with at least one unresolved delay, from the activities list. */
export function delayedActivityIds(
  activities: readonly { id: string; isDelayed: boolean; delays: readonly { resolvedAt: string | null }[] }[],
): Set<string> {
  const ids = new Set<string>();
  for (const activity of activities) {
    const open = activity.delays.some((delay) => delay.resolvedAt === null);
    if (open || activity.isDelayed) ids.add(activity.id);
  }
  return ids;
}

/** An activity is "in the window" when its planned span overlaps [from, to]. */
export function overlapsWindow(
  activity: { plannedStartAt: string; plannedEndAt: string },
  from: string,
  to: string,
): boolean {
  if (!from || !to) return false;
  return activity.plannedStartAt.slice(0, 10) <= to && activity.plannedEndAt.slice(0, 10) >= from;
}
