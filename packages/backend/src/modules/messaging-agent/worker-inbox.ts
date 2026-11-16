import { Readable } from "node:stream";
import type { Knex } from "knex";
import { BadRequestError, ConflictError, ForbiddenError } from "../../lib/errors.ts";
import { messagingAgentAccess } from "./access.ts";
import { proposalReceipt } from "./mappers.ts";
import { messagingAgentReadRepository } from "./read-repository.ts";
import { messagingAgentRepository } from "./repository.ts";
import { messagingAgentReviewService } from "./review-service.ts";
import type { MessagingInboxRow } from "./types.ts";
import { MESSAGING_HELP, type MessagingWorkerConnection, type MessagingWorkerDependencies } from "./worker-types.ts";

export async function enqueueMessagingReply(db: Knex, inbox: MessagingInboxRow, body: string, maxTextLength: number, connection?: MessagingWorkerConnection, purpose = "reply"): Promise<void> {
  if (body.length > maxTextLength) throw new BadRequestError("Split the daily log into shorter messages, or review it in the app.");
  if (purpose !== "error") await messagingAgentRepository(db).cancelPendingReplyErrors(inbox.id);
  await messagingAgentRepository(db).enqueueOutbox({
    inboxId: inbox.id, recipientId: inbox.reply_recipient_id, body, identityId: connection?.identity.id ?? inbox.identity_id,
    conversationId: connection?.conversation.id ?? inbox.conversation_id,
    scopeVersion: connection?.conversation.scope_version ?? inbox.scope_version,
    idempotencyKey: `${inbox.id}:${purpose}`,
  });
}

async function voiceText(db: Knex, inbox: MessagingInboxRow, connection: MessagingWorkerConnection, deps: MessagingWorkerDependencies): Promise<string> {
  const repo = messagingAgentRepository(db);
  if (inbox.source_text) return inbox.source_text;
  let audio = inbox.source_file_id ? await deps.files.readBytes(inbox.source_file_id) : null;
  if (!audio) {
    if (!inbox.media_id) throw new BadRequestError("This voice note has no downloadable audio.");
    const media = await deps.adapters.get(inbox.channel, inbox.channel_account_id).downloadAudio(inbox.media_id);
    const uploaded = await deps.files.upload(connection.identity.user_id, {
      fileName: media.fileName, mimeType: media.mimeType, projectId: connection.conversation.project_id,
      data: Readable.from([media.bytes]),
    });
    await repo.setInboxContent(inbox.id, { sourceFileId: uploaded.id });
    inbox.source_file_id = uploaded.id;
    audio = { ...media, bytes: Buffer.from(media.bytes) };
  }
  const text = await deps.translate(new Blob([audio.bytes], { type: audio.mimeType }), audio.fileName);
  if (!text.trim() || text.length > 20_000) throw new BadRequestError("The voice note is empty or too long. Send a shorter recording or text.");
  await repo.setInboxContent(inbox.id, { sourceText: text, sourceKind: "voice_translation" });
  inbox.source_text = text;
  return text;
}

function requireSnapshot(inbox: MessagingInboxRow, connection: MessagingWorkerConnection): void {
  const { identity, conversation } = connection;
  if (identity.id !== inbox.identity_id || identity.id !== conversation.identity_id || conversation.id !== inbox.conversation_id ||
    identity.revoked_at || identity.opted_out_at || conversation.paused || conversation.scope_version !== inbox.scope_version ||
    identity.channel !== inbox.channel || identity.channel_account_id !== inbox.channel_account_id || identity.sender_id !== inbox.sender_id ||
    conversation.project_id !== inbox.project_id || conversation.building_id !== inbox.building_id || conversation.organization_id !== inbox.organization_id) {
    throw new ForbiddenError("This connection or selected project changed. Send the message again after selecting the project in the app.");
  }
}

export async function handleMessagingInbox(db: Knex, inbox: MessagingInboxRow, deps: MessagingWorkerDependencies): Promise<void> {
  const repo = messagingAgentRepository(db);
  const adapter = deps.adapters.get(inbox.channel, inbox.channel_account_id);
  const text = inbox.source_text?.trim() ?? "";
  const sender = { channel: inbox.channel, channelAccountId: inbox.channel_account_id, senderId: inbox.sender_id };
  const link = inbox.link_code_hash;
  if (link) {
    await db.transaction(async (trx) => {
      const store = messagingAgentRepository(trx);
      const code = await store.readLinkCode(link, sender, deps.now());
      if (!code) throw new BadRequestError("That link code is expired or unavailable. Generate a new code in the app.");
      const access = await messagingAgentAccess(trx).project(code.user_id, code.project_id);
      if (access.project.organization_id !== code.organization_id) throw new ForbiddenError();
      const building = await messagingAgentAccess(trx).building(access, code.building_id);
      const connected = await store.consumeLinkCode(code.code_hash, sender, deps.now(), new Date(inbox.sent_at));
      if (!connected) throw new BadRequestError("This sender is already connected to another account, or the code is unavailable. Unlink the original connection first.");
      await enqueueMessagingReply(trx, inbox, `Connected to Panda.\nProject: ${access.project.name}\nBuilding: ${building.name}\n${MESSAGING_HELP}`, adapter.maxTextLength, connected);
    });
    return;
  }
  let identity = await repo.identityForSender(sender);
  if (/^STOP$/i.test(text)) {
    if (identity) await repo.setOptOut(identity.id, true);
    return;
  }
  if (/^HELP$/i.test(text) || !identity) {
    await enqueueMessagingReply(db, inbox, MESSAGING_HELP, adapter.maxTextLength);
    return;
  }
  if (identity.opted_out_at) return;
  if (inbox.message_type === "unsupported") throw new BadRequestError("Send text or a voice note. Other attachment types are not enabled yet.");

  // Serialize one sender's work and recheck current grants after acquiring locks.
  await db.transaction(async (trx) => {
    identity = await messagingAgentReadRepository(trx).lockIdentity(identity!.id) ?? null;
    const conversation = identity ? await messagingAgentRepository(trx).conversation(identity.id) : null;
    if (!identity || !conversation) throw new ForbiddenError("Reconnect Messaging in the app.");
    const locked = await messagingAgentRepository(trx).lockConversation(conversation.id);
    if (!locked) throw new ForbiddenError();
    const connection = { identity, conversation: locked };
    requireSnapshot(inbox, connection);
    const access = await messagingAgentAccess(trx).project(identity.user_id, locked.project_id, "create");
    const building = await messagingAgentAccess(trx).building(access, locked.building_id);
    if (access.project.organization_id !== locked.organization_id) throw new ForbiddenError();
    const scopeLabel = `Project: ${access.project.name}\nBuilding: ${building.name}\n`;
    const content = inbox.message_type === "audio" ? await voiceText(db, inbox, connection, deps) : inbox.source_text ?? "";
    if (/^STOP$/i.test(content.trim())) { await messagingAgentRepository(trx).setOptOut(identity.id, true); return; }
    if (/^HELP$/i.test(content.trim())) { await enqueueMessagingReply(trx, inbox, MESSAGING_HELP, adapter.maxTextLength, connection); return; }
    const command = /^(CONFIRM|CANCEL)\s+([A-Za-z0-9_-]+)\s+([1-9]\d{0,5})$/i.exec(content.trim());
    const review = messagingAgentReviewService(trx, deps.draft);
    let proposalId: string;
    if (command) {
      const proposal = await messagingAgentRepository(trx).proposal(command[2]!);
      if (!proposal || proposal.conversation_id !== locked.id || proposal.scope_version !== locked.scope_version || proposal.project_id !== locked.project_id || proposal.building_id !== locked.building_id || proposal.organization_id !== locked.organization_id) throw new ConflictError("Open the latest review in the app before confirming.");
      const actions = await messagingAgentRepository(trx).actionsForProposal(proposal.id, proposal.version);
      if (command[1]!.toUpperCase() === "CONFIRM") {
        if ((scopeLabel + proposalReceipt(proposal, actions)).length > adapter.maxTextLength) throw new BadRequestError("Split the daily log into shorter messages, or review it in the app.");
        await review.confirm(identity.user_id, locked.project_id, proposal.id, Number(command[3]));
      } else await review.cancel(identity.user_id, locked.project_id, proposal.id, Number(command[3]));
      proposalId = proposal.id;
    } else {
      if (/^(CONFIRM|CANCEL|LINK)\b/i.test(content.trim())) throw new BadRequestError("Use the exact CONFIRM or CANCEL command shown on the review, including its ID and version.");
      const drafted = await review.draft(inbox, identity, locked, content);
      proposalId = drafted.id;
    }
    const proposal = (await messagingAgentRepository(trx).proposal(proposalId))!;
    const actions = await messagingAgentRepository(trx).actionsForProposal(proposal.id, proposal.version);
    const label = inbox.message_type === "audio" ? "Voice note translated to English for review.\n" : "";
    await enqueueMessagingReply(trx, inbox, scopeLabel + label + proposalReceipt(proposal, actions), adapter.maxTextLength, connection,
      `proposal:${proposal.id}:${proposal.version}:${proposal.status}`);
  });
}
