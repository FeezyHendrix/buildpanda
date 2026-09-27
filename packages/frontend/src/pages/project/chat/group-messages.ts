import type { ChatMessage } from "@/lib/project-types";

export function groupMessages(messages: ChatMessage[]): ChatMessage[][] {
  const groups: ChatMessage[][] = [];

  for (const message of messages) {
    const group = groups[groups.length - 1];
    const previous = group?.[group.length - 1];
    const gap = previous
      ? Date.parse(message.createdAt) - Date.parse(previous.createdAt)
      : Infinity;

    if (group && previous?.authorId === message.authorId && gap < 300_000) {
      group.push(message);
    } else {
      groups.push([message]);
    }
  }

  return groups;
}
