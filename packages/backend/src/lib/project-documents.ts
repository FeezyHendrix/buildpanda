import type { Knex } from "knex";
import { generateId } from "./ids.ts";

function mimeFromName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".mpp")) return "application/vnd.ms-project";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

async function resolveCategoryId(
  db: Knex,
  preferredName: string,
): Promise<string | null> {
  const byName = await db("document_categories").where({ name: preferredName }).first<{ id: string }>("id");
  if (byName) return byName.id;
  const anyDoc = await db("document_categories").where({ group: "document" }).first<{ id: string }>("id");
  if (anyDoc) return anyDoc.id;
  const anyCat = await db("document_categories").first<{ id: string }>("id");
  return anyCat?.id ?? null;
}

export interface AttachDocumentInput {
  projectId: string;
  ownerId: string | null;
  fileName: string;
  storagePath: string;
  sizeBytes?: number;
  mimeType?: string;
  categoryName?: string;
}

export async function attachImportedDocument(db: Knex, input: AttachDocumentInput): Promise<void> {
  const categoryId = await resolveCategoryId(db, input.categoryName ?? "Other");
  if (!categoryId) return;

  const sizeBytes = input.sizeBytes ?? 0;
  const mimeType = input.mimeType ?? mimeFromName(input.fileName);

  await db.transaction(async (trx) => {
    const fileId = generateId("file");
    await trx("uploaded_files").insert({
      id: fileId,
      owner_id: input.ownerId,
      file_name: input.fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      storage_path: input.storagePath,
    });

    const documentId = generateId("doc");
    await trx("project_documents").insert({
      id: documentId,
      project_id: input.projectId,
      category_id: categoryId,
      file_id: fileId,
      file_name: input.fileName,
      size: formatBytes(sizeBytes),
      size_bytes: sizeBytes,
      status: "Verified",
      uploaded_at: new Date().toISOString(),
    });

    const versionId = generateId("dver");
    await trx("document_versions").insert({
      id: versionId,
      document_id: documentId,
      file_id: fileId,
      version_no: 1,
      revision_label: null,
      file_name: input.fileName,
      size: formatBytes(sizeBytes),
      size_bytes: sizeBytes,
      notes: null,
      uploaded_by_id: input.ownerId,
    });

    await trx("project_documents").where({ id: documentId }).update({ current_version_id: versionId });
  });
}
