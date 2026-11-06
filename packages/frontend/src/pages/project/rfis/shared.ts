import type { Rfi, RfiPriority } from "@/lib/project-types";

export const PRIORITY_OPTIONS: { value: RfiPriority; label: string }[] = [
  { value: "High", label: "High" },
  { value: "Normal", label: "Medium" },
  { value: "Low", label: "Low" },
];

export { RFI_PRIORITY_LABEL as PRIORITY_LABEL } from "@/lib/rfi-meta";

export interface RfiFilterValues {
  priority: RfiPriority | null;
  /** `yyyy-mm-dd`, or "" for open-ended. These bound the RFI's due date. */
  dueFrom: string;
  dueTo: string;
}

export const NO_RFI_FILTERS: RfiFilterValues = { priority: null, dueFrom: "", dueTo: "" };

function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Keyword over the RFI number ("rfi 3"), subject, question and who has the ball. */
export function matchesRfiSearch(rfi: Rfi, query: string): boolean {
  const needle = squash(query);
  if (!needle) return true;
  const haystack = squash(`rfi${rfi.number} ${rfi.subject} ${rfi.question} ${rfi.ballInCourtName ?? ""}`);
  return haystack.includes(needle);
}

/** An RFI with no due date can never fall inside a due-date window, so a window hides it. */
export function matchesRfiFilters(rfi: Rfi, filters: RfiFilterValues): boolean {
  if (filters.priority && rfi.priority !== filters.priority) return false;
  if (filters.dueFrom || filters.dueTo) {
    if (!rfi.dueDate) return false;
    const due = rfi.dueDate.slice(0, 10);
    if (filters.dueFrom && due < filters.dueFrom) return false;
    if (filters.dueTo && due > filters.dueTo) return false;
  }
  return true;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

/** "Sept 15" for a due date this year, "Sept 15, 2027" for any other year. */
export function formatDueDate(iso: string, now = new Date()): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  const label = `${MONTHS[month - 1]} ${day}`;
  return year === now.getFullYear() ? label : `${label}, ${year}`;
}
