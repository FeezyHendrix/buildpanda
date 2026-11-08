import type { ChatMessage } from "@/lib/project-types";

/** Local calendar day of a timestamp, as a stable key (`2026-11-03`). */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function groupMessages(messages: ChatMessage[]): ChatMessage[][] {
  const groups: ChatMessage[][] = [];

  for (const message of messages) {
    const group = groups[groups.length - 1];
    const previous = group?.[group.length - 1];
    const gap = previous
      ? Date.parse(message.createdAt) - Date.parse(previous.createdAt)
      : Infinity;

    if (group && previous?.authorId === message.authorId && gap < 300_000 && dayKey(previous.createdAt) === dayKey(message.createdAt)) {
      group.push(message);
    } else {
      groups.push([message]);
    }
  }

  return groups;
}
