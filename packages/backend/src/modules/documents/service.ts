import { BadRequestError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { formatBytes } from "../../lib/file-storage.ts";
import { generateId } from "../../lib/ids.ts";
import type { FilesRepository } from "../files/repository.ts";
import type { DocumentsRepository } from "./repository.ts";
import type {
  CategoryAggregateRow,
  CategoryRow,
  DocumentCategory,
  DocumentRow,
  DocumentStatus,
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

function toDocument(row: DocumentRow, categoryName: string | null): ProjectDocument {
  return {
    id: row.id,
    projectId: row.project_id,
    fileName: row.file_name,
    size: row.size,
    category: categoryName ?? "",
    uploadedAt: row.uploaded_at,
    status: row.status,
  };
}

function toCategory(row: CategoryAggregateRow): DocumentCategory {
  const count = Number(row.file_count);
  return {
    id: row.id,
    name: row.name,
    tone: row.tone,
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
) {
  return {
    async listByProject(projectId: string): Promise<ProjectDocument[]> {
      const [docs, categories] = await Promise.all([
        repository.listByProject(projectId),
        repository.listCategories(),
      ]);
      const categoryNames = new Map<string, string>(
        categories.map((c: CategoryRow) => [c.id, c.name]),
      );
      return docs.map((doc) =>
        toDocument(doc, doc.category_id ? categoryNames.get(doc.category_id) ?? null : null),
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
        throw new BadRequestError(
          "Provide a fileId, or both fileName and size",
        );
      }

      const row = await repository.create({
        id: generateId("doc"),
        project_id: projectId,
        category_id: category.id,
        file_id: fileId,
        file_name: fileName,
        size,
        size_bytes: sizeBytes,
        status: input.status ?? "Pending",
        uploaded_at: input.uploadedAt ?? new Date().toISOString(),
      });

      return toDocument(row, category.name);
    },
  };
}

export type DocumentsService = ReturnType<typeof documentsService>;
