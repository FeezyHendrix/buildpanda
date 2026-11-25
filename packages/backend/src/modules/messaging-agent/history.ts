import { proposalDto } from "./mappers.ts";
import { canReadMessagingAction, canReadMessagingReviewAction, canWriteMessagingAction, proposalCapabilities } from "./policy.ts";
import { parseReviewButtonCommand } from "./reply-buttons.ts";
import { mayReadAnswer } from "./read-access.ts";
import type { MessagingAccess } from "./management-types.ts";
import type { MessagingActionRow, MessagingInboxRow, MessagingOutboxRow, MessagingProposalRow } from "./types.ts";

export function messagingHistory(access: MessagingAccess, proposals: MessagingProposalRow[], actions: MessagingActionRow[], inbox: MessagingInboxRow[], outbox: MessagingOutboxRow[], visibleActions?: ReadonlySet<string>, recordScope?: string, visibleFiles?: ReadonlySet<string>) {
  const byProposal = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const byInbox = new Map(proposals.map((proposal) => [proposal.inbox_id, proposal]));
  const sourceById = new Map(inbox.map((source) => [source.id, source]));
  const actionGroups = new Map<string, MessagingActionRow[]>();
  for (const action of actions) actionGroups.set(action.proposal_id, [...(actionGroups.get(action.proposal_id) ?? []), action]);
  const mayRead = (proposal: MessagingProposalRow) => {
    if (proposal.source_file_id && visibleFiles && !visibleFiles.has(proposal.source_file_id)) return false;
    const items = actionGroups.get(proposal.id) ?? [];
    if (visibleActions && items.some((action) => !visibleActions.has(action.id))) return false;
    if (!items.length) return Boolean(proposal.clarification && access.capabilities.capture);
    return items.every((action) => canReadMessagingReviewAction(access, action)) ||
      (proposal.status === "draft" && items.every((action) => canWriteMessagingAction(access, action)));
  };
  const allHistory = canReadMessagingAction(access, "daily_log") && canReadMessagingAction(access, "material_log");
  const visibleSource = (source: MessagingInboxRow) => {
    if (source.source_file_id && visibleFiles && !visibleFiles.has(source.source_file_id)) return false;
    if (source.read_access) return mayReadAnswer(access, source.read_access, recordScope);
    const command = parseReviewButtonCommand(source.source_text?.trim().replace(/^(confirm|cancel)\b/i, (name) => name.toUpperCase()));
    const proposal = command ? byProposal.get(command.proposalId) : byInbox.get(source.id);
    if (proposal) return mayRead(proposal);
    if (command) return false;
    return allHistory || (access.capabilities.capture && source.status !== "processed");
  };
  const messages = [
    ...inbox.filter(visibleSource).map((message) => ({
      id: message.id, role: "user", text: message.source_text ?? (message.message_type === "audio" ? "Voice note" : message.message_type === "attachment" ? "File attached" : "Unsupported attachment"), createdAt: new Date(message.created_at).toISOString(),
      inputType: message.message_type === "audio" ? "audio" : message.message_type === "attachment" ? "attachment" : "text", status: message.status,
      retryable: message.status === "failed" && message.message_type !== "unsupported" && message.conversation_type === "direct" && message.origin !== "web" && (access.capabilities.capture || access.capabilities.read),
    })),
    ...outbox.filter((message) => { const source = sourceById.get(message.inbox_id); return source ? visibleSource(source) : allHistory; })
      .map((message) => ({ id: message.id, role: "assistant", text: message.body, createdAt: new Date(message.created_at).toISOString() })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { messages, proposals: proposals.filter(mayRead).map((proposal) => proposalDto(proposal, actionGroups.get(proposal.id) ?? [], proposalCapabilities(access, proposal, actionGroups.get(proposal.id) ?? []))) };
}
