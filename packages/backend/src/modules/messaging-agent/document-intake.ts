import { createHash } from "node:crypto";
import type { Knex } from "knex";
import { openStoredFile, streamToBuffer } from "../../lib/file-storage.ts";
import { filesRepository } from "../files/repository.ts";
import { messagingAttachmentRepository } from "./attachment-repository.ts";
import type { MessagingSourceFile } from "./attachment-types.ts";
import { inspectDocument, type DocumentInspection } from "./document-analysis.ts";

export async function inspectMessagingFiles(db: Knex, conversationId: string, files: MessagingSourceFile[]) {
  const repository = messagingAttachmentRepository(db);
  const result: (MessagingSourceFile & { inspection: DocumentInspection })[] = [];
  for (const file of files) {
    const cached = await repository.inspection(conversationId, file.id);
    let inspection = cached;
    if (!inspection && result.length < 6) {
      const row = await filesRepository(db).findById(file.id);
      try {
        if (!row?.storage_path) throw new Error("Missing original");
        const bytes = await streamToBuffer(await openStoredFile(row.storage_path));
        await filesRepository(db).setContentHash(file.id, createHash("sha256").update(bytes).digest("hex"));
        inspection = await inspectDocument({ ...file, bytes });
      } catch {
        inspection = { status: "unavailable", analysis: null, pagesRead: 0, pageCount: null, complete: false,
          notice: "I could not read this original. Tell me its details and where it belongs, or send a clearer copy." };
      }
      // Successful evidence survives clarification and worker retries. Transient failures can retry.
      if (inspection.status === "read") await repository.saveInspection(conversationId, file.id, inspection);
    }
    result.push({ ...file, inspection: inspection ?? { status: "unavailable", analysis: null, pagesRead: 0, pageCount: null, complete: false,
      notice: "Send at most six documents per review so I can read each one." } });
  }
  return result;
}
