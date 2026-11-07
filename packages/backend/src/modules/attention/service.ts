import { localToday } from "../rfis/service.ts";
import type { AttentionRepository } from "./repository.ts";
import type { AttentionFeed, AttentionItem, AttentionKind, AttentionRow, AttentionTag } from "./types.ts";

const LOOK_AHEAD_DAYS = 7;
const TAG_ORDER: Record<AttentionTag, number> = { blocking: 0, due_soon: 1, review: 2 };

const PAGE: Record<AttentionKind, string> = {
  rfi: "rfis",
  approval: "approvals",
  change_request: "change-requests",
  task: "tasks",
  inspection: "inspections",
  permit: "permits",
  key_date: "key-dates",
};
const DEEP_LINK: Partial<Record<AttentionKind, string>> = { rfi: "rfi", approval: "approval", inspection: "inspection" };

function daysUntil(day: string | null, today: string): number | null {
  if (!day) return null;
  return Math.round((Date.parse(`${day.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** The tag is decided here so every client agrees on what "blocking" means. */
export function tagFor(row: AttentionRow, today: string): AttentionTag | null {
  const days = daysUntil(row.due_date, today);
  const late = days !== null && days < 0;
  const soon = days !== null && days >= 0 && days <= LOOK_AHEAD_DAYS;
  switch (row.kind) {
    case "rfi":
      return late ? "blocking" : soon ? "due_soon" : "review";
    case "approval":
      return late ? "blocking" : soon ? "due_soon" : "review";
    case "change_request":
      return row.status === "Submitted" ? "review" : "blocking";
    case "task":
      return late ? "blocking" : soon ? "due_soon" : null;
    case "inspection":
      return "blocking";
    case "permit":
      if (row.status === "Expired" || late) return "blocking";
      if (row.status === "Applied") return "review";
      return soon ? "due_soon" : null;
    case "key_date":
      return row.status === "Missed" || late ? "blocking" : soon ? "due_soon" : null;
  }
}

export function attentionService(repository: AttentionRepository) {
  return {
    async feed(projectId: string, kinds: AttentionKind[], sharedOnly: boolean, limit: number): Promise<AttentionFeed> {
      const today = localToday();
      const items: (AttentionItem & { days: number })[] = [];
      for (const row of await repository.candidates(projectId, kinds, sharedOnly)) {
        const tag = tagFor(row, today);
        if (!tag) continue;
        const key = DEEP_LINK[row.kind];
        items.push({
          id: row.id,
          kind: row.kind,
          tag,
          title: row.title,
          assignee: row.assignee_name ? { id: row.assignee_id, name: row.assignee_name, profession: row.assignee_profession } : null,
          dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
          href: `/project/${projectId}/${PAGE[row.kind]}${key ? `?${key}=${row.id}` : ""}`,
          days: daysUntil(row.due_date, today) ?? Number.MAX_SAFE_INTEGER,
        });
      }
      // Most urgent first: blocking before due soon before review, then the nearest date.
      items.sort((a, b) => TAG_ORDER[a.tag] - TAG_ORDER[b.tag] || a.days - b.days || a.title.localeCompare(b.title));
      return { items: items.slice(0, limit).map(({ days: _days, ...item }) => item), total: items.length };
    },
  };
}
