import { BadRequestError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { formatBytes } from "../../lib/file-storage.ts";
import { generateId } from "../../lib/ids.ts";
import type { FilesRepository } from "../files/repository.ts";
import type { NotificationsService } from "../notifications/service.ts";
import type { DocumentsRepository, VersionWithFile } from "./repository.ts";
import type {
  CategoryAggregateRow,
  CategoryRow,
  DocumentCategory,
  DocumentRow,
  DocumentStatus,
  DocumentVersion,
  DocumentVersionRow,
  ProjectDocument,
} from "./types.ts";

export interface CreateDocumentInput {
  categoryId: string;
  fileId?: string;
  fileName?: string;
  size?: string;
  uploadedAt?: string;
  status?: DocumentStatus;
}

export interface EditDocumentInput {
  categoryId?: string;
  fileName?: string;
  status?: DocumentStatus;
}

export interface AddVersionInput {
  fileId: string;
  revisionLabel?: string;
  notes?: string;
}

export interface DocumentsDeps {
  notifications?: NotificationsService;
}

function notifyDocumentUploaded(
  deps: DocumentsDeps,
  recipientId: string | null | undefined,
  projectId: string,
  fileName: string,
  actorId: string,
): void {
  if (!deps.notifications || !recipientId || recipientId === actorId) return;
  void deps.notifications
    .notify(recipientId, "document_uploaded", {
      title: "A document was uploaded",
      body: fileName,
      projectId,
    })
    .catch(() => undefined);
}

function toDocument(
  row: DocumentRow,
  category: CategoryRow | null,
  versionCount: number,
): ProjectDocument {
  return {
    id: row.id,
    projectId: row.project_id,
    fileName: row.file_name,
    size: row.size,
    category: category?.name ?? "",
    categoryId: row.category_id,
    group: category?.group ?? "document",
    uploadedAt: row.uploaded_at,
    status: row.status,
    versionNo: Math.max(versionCount, row.file_id ? 1 : 0),
    versionCount,
    currentVersionId: row.current_version_id,
  };
}

function toVersion(row: DocumentVersionRow, currentVersionId: string | null): DocumentVersion {
  return {
    id: row.id,
    documentId: row.document_id,
    versionNo: row.version_no,
    revisionLabel: row.revision_label,
    fileName: row.file_name,
    size: row.size,
    notes: row.notes,
    uploadedById: row.uploaded_by_id,
    isCurrent: row.id === currentVersionId,
    createdAt: row.created_at,
  };
}

function toCategory(row: CategoryAggregateRow): DocumentCategory {
  const count = Number(row.file_count);
  return {
    id: row.id,
    name: row.name,
    tone: row.tone,
    group: row.group,
    fileCount: count,
    totalSize: count > 0 ? deriveDisplaySize(row.total_size) : "0 MB",
  };
}

function deriveDisplaySize(aggregate: string | null): string {
  if (!aggregate) return "0 MB";
  const first = aggregate.split(",")[0]?.trim();
  return first ?? "0 MB";
}

export function documentsService(
  repository: DocumentsRepository,
  files: FilesRepository,
  deps: DocumentsDeps = {},
) {
  return {
    async listByProject(projectId: string): Promise<ProjectDocument[]> {
      const [docs, categories, versionCounts] = await Promise.all([
        repository.listByProject(projectId),
        repository.listCategories(),
        repository.versionCountsForProject(projectId),
      ]);
      const byId = new Map<string, CategoryRow>(categories.map((c) => [c.id, c]));
      return docs.map((doc) =>
        toDocument(
          doc,
          doc.category_id ? byId.get(doc.category_id) ?? null : null,
          versionCounts.get(doc.id) ?? (doc.file_id ? 1 : 0),
        ),
      );
    },

    async categoriesForProject(projectId: string): Promise<DocumentCategory[]> {
      const rows = await repository.categoryCountsForProject(projectId);
      return rows.map(toCategory);
    },

    async create(
      projectId: string,
      input: CreateDocumentInput,
      ownerId: string,
    ): Promise<ProjectDocument> {
      const category = await repository.findCategoryById(input.categoryId);
      if (!category) throw new NotFoundError("Document category");

      let fileId: string | null = null;
      let fileName: string | undefined = input.fileName;
      let size: string | undefined = input.size;
      let sizeBytes: number | null = null;

      if (input.fileId) {
        const file = await files.findById(input.fileId);
        if (!file) throw new NotFoundError("File");
        if (file.owner_id !== ownerId) throw new ForbiddenError();
        fileId = file.id;
        fileName = fileName ?? file.file_name;
        sizeBytes = Number(file.size_bytes);
        size = size ?? formatBytes(sizeBytes);
      }

      if (!fileName || !size) {
        throw new BadRequestError("Provide a fileId, or both fileName and size");
      }

      const uploadedAt = input.uploadedAt ?? new Date().toISOString();
      const row = await repository.create({
        id: generateId("doc"),
        project_id: projectId,
        category_id: category.id,
        file_id: fileId,
        file_name: fileName,
        size,
        size_bytes: sizeBytes,
        status: input.status ?? "Pending",
        uploaded_at: uploadedAt,
      });

      // First version (only when there is a real file behind it).
      let versionCount = 0;
      if (fileId) {
        const version = await repository.createVersion({
          id: generateId("dver"),
          document_id: row.id,
          file_id: fileId,
          version_no: 1,
          revision_label: null,
          file_name: fileName,
          size,
          size_bytes: sizeBytes,
          notes: null,
          uploaded_by_id: ownerId,
        });
        await repository.update(row.id, { current_version_id: version.id });
        row.current_version_id = version.id;
        versionCount = 1;
      }

      const recipientIds = await repository.projectRecipientIds(projectId);
      for (const recipientId of recipientIds) {
        notifyDocumentUploaded(deps, recipientId, projectId, row.file_name, ownerId);
      }

      return toDocument(row, category, versionCount);
    },

    async edit(
      projectId: string,
      documentId: string,
      input: EditDocumentInput,
    ): Promise<ProjectDocument> {
      const existing = await repository.findDocumentById(documentId);
      if (!existing || existing.project_id !== projectId) {
        throw new NotFoundError("Document");
      }

      const patch: Parameters<typeof repository.update>[1] = {};
      let category: CategoryRow | null = null;
      if (input.categoryId !== undefined) {
        category = (await repository.findCategoryById(input.categoryId)) ?? null;
        if (!category) throw new NotFoundError("Document category");
        patch.category_id = category.id;
      }
      if (input.fileName !== undefined) patch.file_name = input.fileName;
      if (input.status !== undefined) patch.status = input.status;

      const updated = await repository.update(documentId, patch);
      if (!updated) throw new NotFoundError("Document");

      if (!category && updated.category_id) {
        category = (await repository.findCategoryById(updated.category_id)) ?? null;
      }
      const versionCount =
        (await repository.versionCountsForProject(projectId)).get(documentId) ?? 0;
      return toDocument(updated, category, versionCount);
    },

    async remove(projectId: string, documentId: string): Promise<void> {
      const existing = await repository.findDocumentById(documentId);
      if (!existing || existing.project_id !== projectId) {
        throw new NotFoundError("Document");
      }
      await repository.deleteDocument(documentId);
    },

    // --- Versions ---
    async listVersions(projectId: string, documentId: string): Promise<DocumentVersion[]> {
      const doc = await repository.findDocumentById(documentId);
      if (!doc || doc.project_id !== projectId) throw new NotFoundError("Document");
      const rows = await repository.listVersions(documentId);
      return rows.map((r) => toVersion(r, doc.current_version_id));
    },

    async addVersion(
      projectId: string,
      documentId: string,
      input: AddVersionInput,
      userId: string,
    ): Promise<DocumentVersion> {
      const doc = await repository.findDocumentById(documentId);
      if (!doc || doc.project_id !== projectId) throw new NotFoundError("Document");

      const file = await files.findById(input.fileId);
      if (!file) throw new NotFoundError("File");
      if (file.owner_id !== userId) throw new ForbiddenError();

      const sizeBytes = Number(file.size_bytes);
      const size = formatBytes(sizeBytes);
      const versionNo = await repository.nextVersionNo(documentId);

      const version = await repository.createVersion({
        id: generateId("dver"),
        document_id: documentId,
        file_id: file.id,
        version_no: versionNo,
        revision_label: input.revisionLabel ?? null,
        file_name: file.file_name,
        size,
        size_bytes: sizeBytes,
        notes: input.notes ?? null,
        uploaded_by_id: userId,
      });

      // Repoint the document at the new current version; reset to Pending review.
      await repository.update(documentId, {
        file_id: file.id,
        file_name: file.file_name,
        size,
        size_bytes: sizeBytes,
        uploaded_at: new Date().toISOString(),
        current_version_id: version.id,
        status: "Pending",
      });

      return toVersion(version, version.id);
    },

    /** Resolves a version's stored file for inline viewing (project-scoped). */
    async resolveVersionFile(
      projectId: string,
      documentId: string,
      versionId: string,
    ): Promise<{ storagePath: string; mimeType: string; fileName: string }> {
      const doc = await repository.findDocumentById(documentId);
      if (!doc || doc.project_id !== projectId) throw new NotFoundError("Document");
      const version: VersionWithFile | undefined = await repository.findVersionWithFile(
        documentId,
        versionId,
      );
      if (!version || !version.storage_path) throw new NotFoundError("File");
      return {
        storagePath: version.storage_path,
        mimeType: version.mime_type ?? "application/octet-stream",
        fileName: version.file_name,
      };
    },
  };
}

export type DocumentsService = ReturnType<typeof documentsService>;
