import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { openStoredFile, saveStream, type StoredFile } from "../../lib/file-storage.ts";
import type { FilesRepository } from "./repository.ts";
import type { UploadedFile, UploadedFileRow } from "./types.ts";

export interface IncomingFile {
  fileName: string;
  mimeType: string;
  data: NodeJS.ReadableStream;
}

export interface DownloadHandle {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  stream: NodeJS.ReadableStream;
}

function toFile(row: UploadedFileRow): UploadedFile {
  return {
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function filesService(repository: FilesRepository) {
  return {
    async upload(ownerId: string, incoming: IncomingFile): Promise<UploadedFile> {
      const stored: StoredFile = await saveStream(ownerId, incoming.data);
      const row = await repository.create({
        id: generateId("file"),
        owner_id: ownerId,
        file_name: incoming.fileName,
        mime_type: incoming.mimeType,
        size_bytes: stored.sizeBytes,
        storage_path: stored.storagePath,
      });
      return toFile(row);
    },

    async getMetadata(ownerId: string, id: string): Promise<UploadedFile> {
      const row = await repository.findById(id);
      if (!row) throw new NotFoundError("File");
      if (row.owner_id !== ownerId) throw new ForbiddenError();
      return toFile(row);
    },

    async download(ownerId: string, id: string): Promise<DownloadHandle> {
      const row = await repository.findById(id);
      if (!row) throw new NotFoundError("File");
      if (row.owner_id !== ownerId) throw new ForbiddenError();
      const stream = await openStoredFile(row.storage_path);
      return {
        fileName: row.file_name,
        mimeType: row.mime_type,
        sizeBytes: Number(row.size_bytes),
        stream,
      };
    },
  };
}

export type FilesService = ReturnType<typeof filesService>;
