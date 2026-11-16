import { BadRequestError, ForbiddenError } from "../../lib/errors.ts";
import { messagingRepository } from "../messaging/repository.ts";
import { messagingAccessRepository } from "../messaging/access-repository.ts";
import { messagingService } from "../messaging/service.ts";
import { requireMessageSend, requireWorkspaceRecipient } from "../messaging/send-access.ts";
import { CHAT_EMAIL_DELAY_MS, CHAT_EMAIL_QUEUE } from "../messaging/chat-email-job.ts";
import { ensureProjectGeneral } from "../messaging/general-wiring.ts";
import { collaborationFileId, collaborationFiles } from "./collaboration-files.ts";
import { collaborationNotifications } from "./collaboration-notifications.ts";
import { collaborationSchemas } from "./collaboration-schemas.ts";
import type { CollaborationPayloads } from "./collaboration-types.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import type { FieldToolHandler } from "./tool-types.ts";

const send: FieldToolHandler = async (input, context) => {
  await context.requireFeature("collaboration.messaging");
  const kind = input.kind as "send_message" | "send_direct_message" | "reply_message";
  const payload = validateFieldPayload<CollaborationPayloads[typeof kind]>(collaborationSchemas[kind], input.payload);
  const repository = messagingRepository(context.db);
  const fanout = collaborationNotifications(context);
  const service = messagingService(repository, {
    notifications: fanout.notifications,
    enqueueChatEmail: async (reminder) => {
      await fanout.queue?.enqueue(CHAT_EMAIL_QUEUE, "send", reminder, { delayMs: CHAT_EMAIL_DELAY_MS, jobId: `${reminder.channelId}:${reminder.userId}` });
    },
  });
  const { channelId: targetChannel, projectGeneral, userId, messageId, ...body } = payload as CollaborationPayloads["send_message"] & CollaborationPayloads["send_direct_message"] & CollaborationPayloads["reply_message"];
  let channelId = targetChannel;
  if (kind === "send_message" && projectGeneral === true) {
    await context.request.requireProjectPermission(input.projectId, "messages", "view");
    await context.request.requireProjectPermission(input.projectId, "messages", "send");
    channelId = (await ensureProjectGeneral(context.db, input.projectId, context.user.id)).id;
  } else if (kind === "send_direct_message") {
    await requireWorkspaceRecipient(context.request, messagingAccessRepository(context.db), userId);
    channelId = (await service.openOrCreateDm(userId, context.user.id)).id;
  } else if (kind === "reply_message") {
    const parent = await service.getMessage(messageId, context.user.id);
    channelId = parent.channelId;
    if (body.parentMessageId && body.parentMessageId !== messageId) throw new ForbiddenError("Choose the message being replied to.");
    body.parentMessageId = messageId;
  }
  if (!channelId) throw new BadRequestError("Choose an authorized conversation or explicitly choose the project's General channel.");
  const channel = await requireMessageSend(context.request, repository, channelId, body);
  if ((channel.project_id && channel.project_id !== input.projectId) || (channel.organization_id && channel.organization_id !== context.actor.organizationId)) {
    throw new ForbiddenError("Choose a conversation in this project or workspace.");
  }
  const files = await collaborationFiles(context, body);
  if (body.attachments) body.attachments = body.attachments.map((attachment) => {
    if (collaborationFileId(attachment.url) !== attachment.fileId) throw new ForbiddenError("The attachment URL does not match its uploaded file.");
    const file = files.find((row) => row.id === attachment.fileId)!;
    return { fileId: file.id, url: `/files/${encodeURIComponent(file.id)}/download`, name: file.file_name, mime: file.mime_type, size: Number(file.size_bytes) };
  });
  const message = await service.sendMessage(channelId, body, context.user);
  await fanout.flush();
  return { kind, projectId: input.projectId, recordId: message.id, message: "Message sent.", data: { channelId, parentMessageId: message.parentMessageId } };
};

export const collaborationMessagingHandlers = { send_message: send, send_direct_message: send, reply_message: send } satisfies Record<string, FieldToolHandler>;
