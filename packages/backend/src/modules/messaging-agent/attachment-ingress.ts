import { Readable } from "node:stream";
import type { Knex } from "knex";
import { config } from "../../config/index.ts";
import { BadRequestError, ForbiddenError } from "../../lib/errors.ts";
import { fieldToolContext } from "../field-actions/tool-context.ts";
import { requireFileRead, requireFileStaging } from "../files/access.ts";
import { fileAccessRepository } from "../files/access-repository.ts";
import { filesRepository } from "../files/repository.ts";
import { messagingAgentRepository } from "./repository.ts";
import type { MessagingInboxRow } from "./types.ts";
import type { MessagingWorkerConnection, MessagingWorkerDependencies } from "./worker-types.ts";

/** Called only after worker connection/scope locks and snapshot validation. */
export async function stageMessagingAttachment(db: Knex, inbox: MessagingInboxRow, connection: MessagingWorkerConnection, deps: MessagingWorkerDependencies): Promise<string> {
  const { identity, conversation } = connection;
  if (inbox.identity_id !== identity.id || inbox.conversation_id !== conversation.id || inbox.scope_version !== conversation.scope_version
    || inbox.project_id !== conversation.project_id || inbox.organization_id !== conversation.organization_id || inbox.building_id !== conversation.building_id) throw new ForbiddenError("The attachment's project scope changed.");
  const context = await fieldToolContext(db, { kind: "upload_document", projectId: conversation.project_id, buildingId: conversation.building_id, payload: {}, idempotencyKey: inbox.id },
    { userId: identity.user_id, organizationId: conversation.organization_id });
  await requireFileStaging(context.request, conversation.project_id);
  if (inbox.source_file_id) {
    const original = await filesRepository(db).findById(inbox.source_file_id);
    if (!original || original.owner_id !== identity.user_id || original.project_id !== conversation.project_id) throw new ForbiddenError("This attachment belongs to a different capture scope.");
    await requireFileRead(context.request, original, fileAccessRepository(db));
  } else {
    const adapter = deps.adapters.get(inbox.channel, inbox.channel_account_id);
    if (!inbox.media_id || !adapter.downloadAttachment) throw new BadRequestError("This channel cannot download this attachment. Upload it in Panda Agent.");
    const media = await adapter.downloadAttachment(inbox.media_id);
    if (!media.bytes.byteLength || media.bytes.byteLength > config.uploads.maxFileBytes) throw new BadRequestError("The attachment is empty or exceeds the upload limit.");
    if (!media.fileName || media.fileName.length > 255 || /[\u0000-\u001f\u007f/\\]/.test(media.fileName)) throw new BadRequestError("The attachment filename is invalid.");
    const uploaded = await deps.files.upload(identity.user_id, { fileName: media.fileName, mimeType: media.mimeType, projectId: conversation.project_id, data: Readable.from([media.bytes]) });
    await messagingAgentRepository(db).setInboxContent(inbox.id, { sourceFileId: uploaded.id, sourceKind: "file_attachment" });
    inbox.source_file_id = uploaded.id;
  }
  return inbox.source_text?.trim() || "File attached.";
}
