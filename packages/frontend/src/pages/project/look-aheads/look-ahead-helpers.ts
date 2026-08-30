import type { BadgeTone } from "@/components/atoms/badge";
import type { LookAheadStatus } from "@/lib/project-types";

export const LOOK_AHEAD_STATUS_META: Record<LookAheadStatus, { label: string; tone: BadgeTone }> = {
  Draft: { label: "Draft", tone: "neutral" },
  UnderReview: { label: "Under Review", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
};

export const STATUS_FILTERS: Array<LookAheadStatus | "all"> = ["all", "Draft", "UnderReview", "Approved"];

export function formatLookAheadDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
