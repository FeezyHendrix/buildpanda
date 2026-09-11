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
