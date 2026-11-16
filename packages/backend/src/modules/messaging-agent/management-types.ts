import type { EnrichedAccessContext } from "../../lib/authorization.ts";
import type { FieldToolKind } from "../field-actions/tool-types.ts";
import type { fieldToolDescriptor } from "../field-actions/tools.ts";
import type { ProjectRow } from "../projects/types.ts";
import type { MessagingConversationRow, MessagingIdentityRow, MessagingProposalRow, MessagingScope } from "./types.ts";

export interface MessagingDraftScope extends MessagingScope {
  projectName?: string;
  buildingName?: string;
  projectCurrency?: string;
  messageSentAt?: string;
  recentMessages?: MessagingContextMessage[];
  tools?: ReturnType<typeof fieldToolDescriptor>[];
  targets?: Record<string, unknown>;
  reads?: MessagingReadSpec[];
  runRead?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

export interface MessagingContextMessage { role: "user" | "assistant"; content: string; sentAt?: string }
export interface MessagingReadSpec { name: string; description: string; parameters: Record<string, unknown> }
export interface MessagingAnswer { kind: "answer"; answer: string }
export interface MessagingReadAccess { permissions: Record<string, string[]>; workspacePermissions: Record<string, string[]>; features: Readonly<Record<string, boolean>>; recordScope?: string }
export interface MessagingDocumentArtifact {
  kind: "document";
  projectId: string;
  documentId: string;
  versionId: string;
  fileName: string;
  mimeType: string;
  apiPath: string;
  url: string;
  download: boolean;
}

export interface MessagingCapabilities {
  capture: boolean;
  read: boolean;
  dailyLogCreate: boolean;
  materialReceipt: boolean;
  materialUsage: boolean;
  actions?: Partial<Record<FieldToolKind, boolean>>;
}

export interface MessagingProposalCapabilities { edit: boolean; confirm: boolean; cancel: boolean }

export interface MessagingFeatures { dailyLogs: boolean; materialLogs: boolean; enabled?: Readonly<Record<string, boolean>> }

export interface MessagingUserRow {
  id: string;
  name: string;
  banned: boolean;
  banExpires: Date | string | null;
}

export interface MessagingAccess {
  user: MessagingUserRow;
  project: ProjectRow;
  context: EnrichedAccessContext;
  permissions: Record<string, string[]>;
  workspacePermissions?: Record<string, string[]>;
  features: MessagingFeatures;
  capabilities: MessagingCapabilities;
}

export interface MessagingProjectOption {
  id: string;
  name: string;
  organizationId: string | null;
}

export interface MessagingScopeInput {
  projectId: string;
  buildingId?: string | null;
  connectionId: string;
}

export interface MessagingLinkInput {
  channel: string;
  accountId: string;
  projectId: string;
  buildingId?: string | null;
}

export interface MessagingReviewAction {
  kind: FieldToolKind;
  title: string;
  summary?: string;
  payload: Record<string, unknown>;
  missing?: string[];
  reviewId?: string;
}

export interface MessagingDraftInput {
  text: string;
  connectionId: string;
}

export interface MessagingReviewInput {
  version: number;
  actions?: MessagingReviewAction[];
}

export interface MessagingConnectionRow extends MessagingIdentityRow {
  conversation: MessagingConversationRow;
}

export interface MessagingOwnedProposal extends MessagingProposalRow {
  identity_id: string;
  sender_id: string;
  channel: string;
  channel_account_id: string;
}
