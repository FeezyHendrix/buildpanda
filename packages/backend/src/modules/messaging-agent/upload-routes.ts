import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";
import { config } from "../../config/index.ts";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { fieldToolContext } from "../field-actions/tool-context.ts";
import { requireFileStaging } from "../files/access.ts";
import { filesRepository } from "../files/repository.ts";
import { filesService } from "../files/service.ts";
import { messagingAgentAccess } from "./access.ts";
import { configuredMessagingAdapters } from "./adapters/index.ts";
import { messagingAgentRepository } from "./repository.ts";
import { messagingAgentReadRepository } from "./read-repository.ts";
import { messagingAgentReviewService } from "./review-service.ts";
import { requireMessagingEnabled } from "./service.ts";
import { projectParams } from "./schemas.ts";
import type { MessagingUploadOptions } from "./attachment-types.ts";

/** A real upload is retained as an inbox source before AI drafting begins. */
const messagingUploadRoutes: FastifyPluginAsync<MessagingUploadOptions> = async (app, options) => {
  await app.register(multipart, { limits: { fileSize: config.uploads.maxFileBytes, files: 1, fields: 2, fieldSize: 20_000 }, throwFileSizeLimit: true });
  const adapters = options.adapters ?? configuredMessagingAdapters();
  const files = options.files ?? filesService(filesRepository(app.db));
  app.post<{ Params: { projectId: string } }>("/messaging-agent/projects/:projectId/messages/upload", {
    schema: { params: projectParams, response: { 200: {
      type: "object", required: ["messageId", "file"], additionalProperties: false,
      properties: { messageId: { type: "string" }, file: {
        type: "object", required: ["id", "fileName", "mimeType", "sizeBytes", "createdAt"], additionalProperties: false,
        properties: { id: { type: "string" }, fileName: { type: "string" }, mimeType: { type: "string" }, sizeBytes: { type: "integer" }, createdAt: { type: "string" } },
      } },
    } } }, bodyLimit: config.uploads.maxFileBytes + 64 * 1024,
  }, async (request) => {
    const user = request.requireAuth(), projectId = request.params.projectId;
    requireMessagingEnabled(adapters);
    const access = await messagingAgentAccess(app.db).project(user.id, projectId);
    const staging = await fieldToolContext(app.db, { kind: "upload_document", projectId, buildingId: null, payload: {}, idempotencyKey: randomUUID() },
      { userId: user.id, organizationId: access.project.organization_id });
    await requireFileStaging(staging.request, projectId);
    let connectionId = "", text = "";
    let upload: { bytes: Buffer; fileName: string; mimeType: string } | undefined;
    const fields = new Set<string>();
    for await (const part of request.parts()) {
      if (part.type === "field") {
        if (upload || !["connectionId", "text"].includes(part.fieldname) || fields.has(part.fieldname) || part.valueTruncated) throw new BadRequestError("Provide connectionId and optional text once, before the file field.");
        fields.add(part.fieldname);
        const value = String(part.value);
        if (part.fieldname === "connectionId") connectionId = value;
        else text = value.trim();
        continue;
      }
      if (upload || !connectionId || connectionId.length > 100 || text.length > 20_000 || part.fieldname !== "file") throw new BadRequestError("Provide connectionId and optional text before a single file field.");
      if (!part.filename || part.filename.length > 255 || /[\u0000-\u001f\u007f/\\]/.test(part.filename)) throw new BadRequestError("The attachment filename is invalid.");
      // Resolve the current connection before consuming any file bytes; the write rechecks it under locks.
      const linked = await messagingAgentReadRepository(app.db).connection(user.id, connectionId);
      if (!linked) throw new NotFoundError("Messaging connection");
      if (linked.opted_out_at || linked.conversation.paused || linked.conversation.project_id !== projectId) throw new ConflictError("Select an active connection on this project before attaching files.");
      const bytes = await part.toBuffer();
      if (!bytes.byteLength || bytes.byteLength > config.uploads.maxFileBytes || part.file.truncated) throw new BadRequestError("The attachment is empty or exceeds the upload limit.");
      upload = { bytes, fileName: part.filename, mimeType: part.mimetype };
    }
    if (!upload) throw new BadRequestError("Choose a file to attach.");
    const incoming = upload;

    const captured = await app.db.transaction(async (transaction) => {
      const reads = messagingAgentReadRepository(transaction), repo = messagingAgentRepository(transaction);
      const linked = await reads.connection(user.id, connectionId);
      if (!linked) throw new NotFoundError("Messaging connection");
      const identity = await reads.lockIdentity(linked.id), conversation = await repo.lockConversation(linked.conversation.id);
      if (!identity || !conversation || identity.revoked_at || identity.opted_out_at || conversation.paused) throw new ForbiddenError("Reconnect this messaging account before attaching files.");
      adapters.get(identity.channel, identity.channel_account_id);
      if (conversation.project_id !== projectId) throw new ConflictError("Select this project on the messaging connection first.");
      const context = await fieldToolContext(transaction, { kind: "upload_document", projectId, buildingId: conversation.building_id, payload: {}, idempotencyKey: randomUUID() },
        { userId: user.id, organizationId: conversation.organization_id });
      await requireFileStaging(context.request, projectId);
      const file = await files.upload(user.id, { fileName: incoming.fileName, mimeType: incoming.mimeType, projectId, data: Readable.from([incoming.bytes]) });
      const inbox = await repo.acceptMessage({ channel: identity.channel, channelAccountId: identity.channel_account_id, senderId: identity.sender_id,
        replyRecipientId: identity.sender_id, conversationType: "direct", origin: "web", providerMessageId: randomUUID(),
        type: "attachment", text: text || "File attached.", sentAt: new Date(), sourceFileId: file.id,
        mediaId: null, mediaMimeType: incoming.mimeType, replyToMessageId: null });
      if (!inbox) throw new ConflictError("This upload has already been received.");
      await repo.claimInbox(inbox.id);
      return { inbox, identity, conversation, file };
    });
    const repo = messagingAgentRepository(app.db);
    try {
      const result = await messagingAgentReviewService(app.db, options.draft, app.queue).draft(captured.inbox, captured.identity, captured.conversation, captured.inbox.source_text ?? "File attached.");
      if ("kind" in result && result.kind === "answer") {
        const reply = await repo.enqueueOutbox({ inboxId: captured.inbox.id, identityId: captured.identity.id, conversationId: captured.conversation.id,
          scopeVersion: captured.conversation.scope_version, body: result.answer, recipientId: captured.identity.sender_id, idempotencyKey: `${captured.inbox.id}:answer` });
        await repo.acknowledgeWebReply(reply.id);
      }
      await repo.completeInbox(captured.inbox.id);
      return { messageId: captured.inbox.id, file: captured.file };
    } catch (error) {
      await repo.failInbox(captured.inbox.id, error instanceof Error ? error.message : "File draft failed");
      throw error;
    }
  });
};

export default messagingUploadRoutes;
