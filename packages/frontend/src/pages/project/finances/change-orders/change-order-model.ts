import { CHANGE_TYPE_LABELS } from "@/components/molecules/upsert-change-request-dialog";
import { formatWholeCurrency } from "@/lib/formatters";
import type { ChangeRequest, ChangeStatus, ChangeType } from "@/lib/project-types";

/** The type pills over the board. `all` is the board unfiltered. */
export const TYPE_PILLS: readonly { value: ChangeType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "variation", label: "Variations" },
  { value: "omission", label: "Omissions" },
  { value: "eot_only", label: "Time Claims" },
  { value: "provisional_sum", label: "Provisional Sums" },
];
export type TypePill = (typeof TYPE_PILLS)[number]["value"];

/** The ladder, left to right: a change is raised, decided, then executed — or sent back. */
export const BOARD_COLUMNS: readonly { status: ChangeStatus; label: string }[] = [
  { status: "Draft", label: "Draft" },
  { status: "Submitted", label: "Submitted" },
  { status: "Approved", label: "Approved" },
  { status: "Executed", label: "Executed" },
  { status: "Rejected", label: "Rejected" },
];

/** The status pill on a card: shape and label carry the meaning, colour only reinforces it. */
export const STATUS_PILL: Record<ChangeStatus, string> = {
  Draft: "border-[#EEEEEE] bg-white text-[#1E1E1E]",
  Submitted: "border-transparent bg-[#E6EDFD] text-[#004DE7]",
  Approved: "border-[#B9F8CF] bg-[#F0FDF4] text-[#00A63E]",
  Executed: "border-[#C6CCFF] bg-white text-[#5D5FEF]",
  Rejected: "border-[#FFC9C9] bg-[#FEF2F2] text-[#E7000B]",
};

export function typeLabel(type: ChangeType): string {
  return CHANGE_TYPE_LABELS[type].label;
}

function days(count: number): string {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

/**
 * The line under a card's title. A time claim has no money, so it reads as days
 * claimed (and awarded once decided); everything else is the cost and any time it moves.
 */
export function impactLine(cr: Pick<ChangeRequest, "type" | "costImpact" | "currency" | "timeImpactDays" | "daysAwarded">): string {
  if (cr.type === "eot_only") {
    const claimed = `${days(cr.timeImpactDays)} claimed`;
    return cr.daysAwarded === null ? claimed : `${claimed} • ${days(cr.daysAwarded)} awarded`;
  }
  const cost = formatWholeCurrency(cr.costImpact, cr.currency);
  return cr.timeImpactDays > 0 ? `${cost} • +${days(cr.timeImpactDays)}` : cost;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}
