import type { Knex } from "knex";

export type MessagingSourceKind = "text" | "voice_translation";
export type MessagingConversationType = "direct" | "group";
export type MessagingMessageOrigin = "provider" | "web";
export type MessagingInboxStatus = "received" | "processing" | "processed" | "failed";
export type MessagingProposalStatus = "draft" | "confirmed" | "completed" | "cancelled";
export type MessagingActionStatus = "proposed" | "committed" | "failed";
export type MessagingOutboxStatus = "pending" | "sending" | "accepted" | "sent" | "delivered" | "read" | "failed" | "unknown" | "cancelled";
export type MessagingDb = Knex | Knex.Transaction;

export interface MessagingChannelAccount {
  channel: string;
  channelAccountId: string;
}

export interface MessagingScope {
  organizationId: string | null;
  projectId: string;
  buildingId: string;
}

export interface MessagingIdentityRow {
  id: string;
  channel: string;
  channel_account_id: string;
  sender_id: string;
  user_id: string;
  opted_out_at: Date | string | null;
  revoked_at: Date | string | null;
  last_inbound_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface MessagingConversationRow {
  id: string;
  identity_id: string;
  organization_id: string | null;
  project_id: string;
  building_id: string;
  scope_version: number;
  paused: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface MessagingLinkCodeInput extends MessagingScope, MessagingChannelAccount {
  userId: string;
  codeHash: string;
  expiresAt: Date;
}

export interface MessagingLinkCodeRow {
  id: string;
  channel: string;
  channel_account_id: string;
  user_id: string;
  organization_id: string | null;
  project_id: string;
  building_id: string;
  code_hash: string;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  created_at: Date | string;
}

export interface MessagingSender extends MessagingChannelAccount {
  senderId: string;
}

export interface MessagingInboundMessage extends MessagingSender {
  origin?: MessagingMessageOrigin;
  replyRecipientId: string;
  conversationType: MessagingConversationType;
  providerMessageId: string;
  sentAt: Date;
  type: "text" | "audio" | "unsupported";
  text: string | null;
  mediaId: string | null;
  mediaMimeType: string | null;
  replyToMessageId: string | null;
}

export interface MessagingDeliveryStatus extends MessagingChannelAccount {
  providerMessageId: string;
  recipientId: string | null;
  status: "sent" | "delivered" | "read" | "failed";
  sentAt: Date;
}

export interface MessagingWebhookEvents {
  messages: MessagingInboundMessage[];
  statuses: MessagingDeliveryStatus[];
}

export interface MessagingInboxRow {
  id: string;
  channel: string;
  channel_account_id: string;
  provider_message_id: string;
  sender_id: string;
  reply_recipient_id: string;
  conversation_type: MessagingConversationType;
  origin: MessagingMessageOrigin;
  identity_id: string | null;
  conversation_id: string | null;
  organization_id: string | null;
  project_id: string | null;
  building_id: string | null;
  scope_version: number | null;
  message_type: "text" | "audio" | "unsupported";
  source_text: string | null;
  link_code_hash: string | null;
  source_kind: MessagingSourceKind;
  source_file_id: string | null;
  media_id: string | null;
  media_mime_type: string | null;
  reply_to_message_id: string | null;
  sent_at: Date | string;
  status: MessagingInboxStatus;
  attempts: number;
  processing_started_at: Date | string | null;
  last_error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface MessagingRecoverableMessageRow extends MessagingInboxRow {
  identity: MessagingIdentityRow;
  conversation: MessagingConversationRow;
}

export interface MessagingProposedActionInput {
  kind: string;
  payload: Record<string, unknown>;
  title?: string;
  summary?: string;
}

export interface MessagingProposalInput {
  conversationId: string;
  inboxId: string;
  scopeVersion: number;
  actions: MessagingProposedActionInput[];
  sourceText: string;
  sourceKind: MessagingSourceKind;
  sourceFileId?: string | null;
}

export interface MessagingProposalRow {
  id: string;
  conversation_id: string;
  inbox_id: string;
  organization_id: string | null;
  project_id: string;
  building_id: string;
  scope_version: number;
  version: number;
  status: MessagingProposalStatus;
  source_text: string;
  source_kind: MessagingSourceKind;
  source_file_id: string | null;
  confirmed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface MessagingActionRow {
  id: string;
  proposal_id: string;
  proposal_version: number;
  position: number;
  kind: string;
  title: string | null;
  summary: string | null;
  payload: Record<string, unknown>;
  status: MessagingActionStatus;
  result: Record<string, unknown> | null;
  last_error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface MessagingOutboxInput {
  inboxId: string;
  identityId: string | null;
  conversationId?: string | null;
  body: string;
  recipientId: string;
  scopeVersion?: number | null;
  idempotencyKey: string;
  buttons?: MessagingReplyButton[];
}

export interface MessagingOutboxRow {
  id: string;
  channel: string;
  channel_account_id: string;
  inbox_id: string;
  identity_id: string | null;
  conversation_id: string | null;
  recipient_id: string;
  body: string;
  buttons: MessagingReplyButton[] | null;
  scope_version: number | null;
  idempotency_key: string;
  status: MessagingOutboxStatus;
  attempts: number;
  provider_message_id: string | null;
  last_error: string | null;
  sending_started_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface MessagingSendInput {
  to: string;
  text: string;
  replyToMessageId?: string;
  buttons?: MessagingReplyButton[];
}

export interface MessagingReplyButton {
  label: "Confirm" | "Cancel";
  command: string;
}

export interface MessagingReviewButtonCommand {
  action: "CONFIRM" | "CANCEL";
  proposalId: string;
  version: number;
}

export interface MessagingReviewContext {
  projectName: string;
  buildingName: string;
  voiceNote: boolean;
}

export type MessagingSendResult =
  | { status: "accepted"; messageId: string }
  | { status: "rejected"; reason: string; retryable: boolean }
  | { status: "unknown"; reason: string };

export interface MessagingMedia {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
}
