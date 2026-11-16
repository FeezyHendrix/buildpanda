import type { Knex } from "knex";
import { ForbiddenError, BadRequestError } from "../../lib/errors.ts";
import { fieldToolContext } from "../field-actions/tool-context.ts";
import { requireFileRead, requireFileStaging } from "../files/access.ts";
import { fileAccessRepository } from "../files/access-repository.ts";
import { filesRepository } from "../files/repository.ts";
import { messagingAttachmentRepository } from "./attachment-repository.ts";
import type { MessagingSourceFile } from "./attachment-types.ts";

/** Originals from this pending conversation only; a voice translation is not silently treated as evidence. */
export async function messagingSourceFiles(db: Knex, conversationId: string, scopeVersion: number, currentInboxId: string): Promise<MessagingSourceFile[]> {
  const sources = await messagingAttachmentRepository(db).sourceFiles(conversationId, scopeVersion, currentInboxId);
  if (sources.length > 100) throw new BadRequestError("This capture has too many files. Cancel it and send a smaller batch.");
  if (!sources.length) return [];
  const first = sources[0]!;
  const context = await fieldToolContext(db, { kind: "upload_document", projectId: first.projectId, buildingId: first.buildingId, payload: {}, idempotencyKey: currentInboxId }, { userId: first.userId, organizationId: first.organizationId });
  await requireFileStaging(context.request, first.projectId);
  const permitted: MessagingSourceFile[] = [];
  const files = await filesRepository(db).findByIds(sources.map((source) => source.id));
  const byId = new Map(files.map((file) => [file.id, file]));
  for (const source of sources) {
    const file = byId.get(source.id);
    if (!file) continue;
    try {
      await requireFileRead(context.request, file, fileAccessRepository(db));
      permitted.push({ id: source.id, fileName: source.fileName, mimeType: source.mimeType, sizeBytes: Number(source.sizeBytes) });
    } catch (error) { if (!(error instanceof ForbiddenError)) throw error; }
  }
  return permitted;
}
