import type { MessagingLink, MessagingStatus } from "../api/messaging-agent";
import type { ProjectAccess } from "./project-types";

// One card per channel; each stays hidden until the server reports that channel enabled.
export const MESSAGING_CHANNELS = [
  { id: "telegram", label: "Telegram", startStep: "tap Start in Telegram" },
  { id: "whatsapp", label: "WhatsApp", startStep: "send the prefilled LINK message in WhatsApp" },
] as const;
export type MessagingChannelOption = (typeof MESSAGING_CHANNELS)[number];

// Linking needs project access; the server additionally requires an enabled, permitted field tool.
export const messagingConnectionPolicy = { resource: "project", action: "view" } as const;

export function canConnectMessaging(access: ProjectAccess | undefined): boolean {
  const { resource, action } = messagingConnectionPolicy;
  return access?.permissions?.[resource]?.includes(action) === true;
}

export function connectionChannel(status: MessagingStatus | undefined, userId: string, projectId: string, channelId: MessagingChannelOption["id"]) {
  if (!status?.enabled || status.userId !== userId || !status.projects.some((project) => project.id === projectId)) return undefined;
  return status.channels.find((channel) => channel.id === channelId && channel.enabled);
}

const CODE = /^[A-Za-z0-9_-]{24,64}$/;

// The server builds the link; the client only lets the exact provider handoff for that channel leave the app.
function isProviderLink(url: URL, channelId: MessagingChannelOption["id"], code: string): boolean {
  if (url.protocol !== "https:" || url.username || url.password || url.hash || !CODE.test(code)) return false;
  if (channelId === "telegram") return url.host === "t.me" && /^\/[A-Za-z][A-Za-z0-9_]{4,31}$/.test(url.pathname) && url.search === `?start=${code}`;
  return url.host === "wa.me" && /^\/\d{6,15}$/.test(url.pathname) && url.search === `?text=${encodeURIComponent(`LINK ${code}`)}`;
}

export function channelConnectUrl(link: MessagingLink, channel: MessagingChannelOption, now = Date.now()): string {
  if (!link.connectUrl || !Number.isFinite(Date.parse(link.expiresAt)) || Date.parse(link.expiresAt) <= now) throw new Error(`The connection link expired. Tap Connect ${channel.label} again.`);
  const url = new URL(link.connectUrl);
  if (!isProviderLink(url, channel.id, link.code)) throw new Error(`${channel.label} returned an invalid connection link. Please try again.`);
  return url.href;
}
