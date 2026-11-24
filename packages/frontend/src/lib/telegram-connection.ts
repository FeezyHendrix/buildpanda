import type { MessagingLink, MessagingStatus } from "../api/messaging-agent";
import type { ProjectAccess } from "./project-types";

// Linking needs project access; the server additionally requires an enabled, permitted field tool.
export const telegramConnectionPolicy = { resource: "project", action: "view" } as const;

export function canConnectTelegram(access: ProjectAccess | undefined): boolean {
  const { resource, action } = telegramConnectionPolicy;
  return access?.permissions?.[resource]?.includes(action) === true;
}

export function telegramChannel(status: MessagingStatus | undefined, userId: string, projectId: string) {
  if (!status?.enabled || status.userId !== userId || !status.projects.some((project) => project.id === projectId)) return undefined;
  return status.channels.find((channel) => channel.id === "telegram" && channel.enabled);
}

export function telegramConnectUrl(link: MessagingLink, now = Date.now()): string {
  if (!link.connectUrl || !Number.isFinite(Date.parse(link.expiresAt)) || Date.parse(link.expiresAt) <= now) throw new Error("The connection link expired. Tap Connect Telegram again.");
  const url = new URL(link.connectUrl);
  if (url.protocol !== "https:" || url.host !== "t.me" || url.username || url.password || url.hash ||
    !/^\/[A-Za-z][A-Za-z0-9_]{4,31}$/.test(url.pathname) || !/^[A-Za-z0-9_-]{24,64}$/.test(link.code) ||
    url.search !== `?start=${link.code}`) throw new Error("Telegram returned an invalid connection link. Please try again.");
  return url.href;
}
