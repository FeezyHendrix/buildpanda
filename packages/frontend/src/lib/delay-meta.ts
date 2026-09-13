import type { BadgeTone } from "@/components/atoms/badge";
import type { Culpability, DelayReason } from "./project-types";

/**
 * Who carries the time risk, said in the words a contract uses. Tone is paired
 * with a distinct glyph so the attribution is never colour alone (WCAG 1.4.1).
 */
export const CULPABILITY_META: Record<
  Culpability,
  { label: string; short: string; tone: BadgeTone; glyph: string }
> = {
  contractor: { label: "Contractor's risk", short: "Contractor", tone: "danger", glyph: "▲" },
  client: { label: "Client's risk", short: "Client", tone: "info", glyph: "▼" },
  neutral: { label: "Neutral event", short: "Neutral", tone: "neutral", glyph: "▬" },
};

export const CULPABILITY_OPTIONS: { value: Culpability; label: string }[] = [
  { value: "contractor", label: CULPABILITY_META.contractor.label },
  { value: "client", label: CULPABILITY_META.client.label },
  { value: "neutral", label: CULPABILITY_META.neutral.label },
];

/**
 * A contractor's own breakdown never buys time back, whatever the form says —
 * the server enforces it, so the toggle explains itself instead of lying.
 */
export const CONTRACTOR_NO_EOT_REASON =
  "A contractor-culpable delay cannot be claimed as an extension of time.";

/** Delay reasons grouped by the category the picker shows as an optgroup. */
export function groupReasons(reasons: DelayReason[]): [string, DelayReason[]][] {
  const grouped = new Map<string, DelayReason[]>();
  for (const reason of reasons) {
    const list = grouped.get(reason.category);
    if (list) list.push(reason);
    else grouped.set(reason.category, [reason]);
  }
  return [...grouped.entries()];
}

/** "2 days" / "1 day" — programme arithmetic is always counted in working days. */
export function workingDaysLabel(days: number): string {
  return `${days} working ${Math.abs(days) === 1 ? "day" : "days"}`;
}

/** "+14 days" / "-3 days" — an EOT award is counted in calendar days. */
export function signedDaysLabel(days: number): string {
  const unit = Math.abs(days) === 1 ? "day" : "days";
  return days > 0 ? `+${days} ${unit}` : `${days} ${unit}`;
}

/** The local `datetime-local` value for a date, e.g. "2026-09-13T07:00". */
export function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** True when the picked local datetime falls on a day after today. */
export function isFutureDay(localInput: string): boolean {
  if (!localInput) return false;
  const picked = new Date(localInput);
  if (Number.isNaN(picked.getTime())) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return picked.getTime() > endOfToday.getTime();
}
