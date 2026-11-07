import type { RfiPriority } from "@/lib/project-types";

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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

/** "Sept 15" for a due date this year, "Sept 15, 2027" for any other year. */
export function formatDueDate(iso: string, now = new Date()): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  const label = `${MONTHS[month - 1]} ${day}`;
  return year === now.getFullYear() ? label : `${label}, ${year}`;
}
