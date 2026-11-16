import type { EnrichedAccessContext } from "../../lib/authorization.ts";
import type { ProjectRow } from "../projects/types.ts";
import type { MessagingConversationRow, MessagingIdentityRow, MessagingProposalRow, MessagingScope } from "./types.ts";

export interface MessagingDraftScope extends MessagingScope {
  projectName?: string;
  buildingName?: string;
}

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
  kind: "daily_log" | "update_daily_log";
  title: string;
  summary?: string;
  payload: Record<string, unknown>;
  missing?: string[];
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
