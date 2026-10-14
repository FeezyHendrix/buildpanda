import type { NotificationType } from "./common";

export type ReportPeriod = "weekly" | "monthly" | "quarterly" | "semiAnnual" | "annual";

export const REPORT_PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semiAnnual", label: "Semi-Annual" },
  { value: "annual", label: "Annual" },
];

export interface Notification {
  ctaUrl?: string | null;
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  projectId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResult {
  notifications: Notification[];
  unreadCount: number;
}

export interface NotificationPreference {
  type: NotificationType;
  label: string;
  group: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

export interface SearchProjectHit {
  id: string;
  name: string;
  address: string;
  snippet: string;
}

export interface SearchUpdateHit {
  id: string;
  projectId: string;
  title: string;
  snippet: string;
  category: string;
}

export interface SearchDocumentHit {
  id: string;
  projectId: string;
  fileName: string;
  category: string;
}

export interface SearchInspectionHit {
  id: string;
  projectId: string;
  title: string;
  snippet: string;
  category: string;
}

export interface SearchResults {
  query: string;
  projects: SearchProjectHit[];
  updates: SearchUpdateHit[];
  documents: SearchDocumentHit[];
  inspections: SearchInspectionHit[];
}

export interface UploadedFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export type ChannelType = "project" | "org" | "dm" | "group_dm";
export type NotifyLevel = "all" | "mentions" | "none";

export interface Channel {
  id: string;
  type: ChannelType;
  name: string | null;
  topic: string | null;
  projectId: string | null;
  organizationId: string | null;
  isPrivate: boolean;
  archivedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  muted: boolean;
  notifyLevel: NotifyLevel;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  contentHtml: string | null;
  parentMessageId: string | null;
  quotedMessageId: string | null;
  quotedMessage?: {
    id: string;
    authorName: string | null;
    body: string;
    deleted: boolean;
  } | null;
  references: { type: string; id: string; label: string }[];
  resolvedReferences?: {
    type: string;
    id: string;
    restricted: boolean;
    title?: string;
    status?: string | null;
    projectId?: string | null;
    url?: string;
  }[];
  mentions: { kind: "user" | "here" | "channel"; userId?: string }[];
  attachments: { fileId: string; url: string; name: string; mime?: string; size?: number }[];
  reactions?: { emoji: string; count: number; mine: boolean }[];
  replyCount?: number;
  readAt?: string | null;
  readBy?: number;
  recipientCount?: number;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface ChannelMemberLite {
  id: string;
  name: string | null;
  email: string;
  role: "admin" | "member";
}
