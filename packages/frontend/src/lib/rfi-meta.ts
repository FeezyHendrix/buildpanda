import type { BadgeTone } from "@/components/atoms/badge";
import type { Rfi, RfiStatus } from "@/lib/project-types";

export const RFI_STATUS_META: Record<RfiStatus, { label: string; tone: BadgeTone }> = {
  Draft: { label: "Draft", tone: "neutral" },
  Open: { label: "Open", tone: "info" },
  InReview: { label: "In review", tone: "warning" },
  Answered: { label: "Answered", tone: "success" },
  Closed: { label: "Closed", tone: "neutral" },
  Void: { label: "Void", tone: "danger" },
};

/** An RFI still waiting on an answer is "live"; answered and closed ones are not. */
export function isAwaitingAnswer(rfi: Pick<Rfi, "status">): boolean {
  return rfi.status === "Draft" || rfi.status === "Open" || rfi.status === "InReview";
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Overdue means the answer date has passed and nobody has answered. A late RFI
 * response is a claimable delay, so the PM has to be able to see it at a glance
 * (findings F36).
 */
export function isRfiOverdue(rfi: Pick<Rfi, "status" | "dueDate">, today = todayIso()): boolean {
  if (!rfi.dueDate) return false;
  if (!isAwaitingAnswer(rfi)) return false;
  return rfi.dueDate.slice(0, 10) < today;
}

/** Whole days past the due date, 0 when not overdue. */
export function rfiOverdueDays(rfi: Pick<Rfi, "status" | "dueDate">, today = todayIso()): number {
  if (!isRfiOverdue(rfi, today)) return 0;
  const due = new Date(`${rfi.dueDate!.slice(0, 10)}T00:00:00`).getTime();
  const now = new Date(`${today}T00:00:00`).getTime();
  return Math.max(0, Math.round((now - due) / 86_400_000));
}

export function overdueLabel(days: number): string {
  return days === 1 ? "Overdue 1 day" : `Overdue ${days} days`;
}
