import { ForbiddenError, NotFoundError, ServiceUnavailableError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import {
  getDownloadUrl,
  openStoredFile,
  saveStream,
  streamToBuffer,
  type StoredFile,
} from "../../lib/file-storage.ts";
import type { FilesRepository } from "./repository.ts";
import type { UploadedFile, UploadedFileRow } from "./types.ts";

export interface IncomingFile {
  fileName: string;
  mimeType: string;
  projectId?: string | null;
  data: NodeJS.ReadableStream;
}

export interface DownloadHandle {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  stream: NodeJS.ReadableStream;
}

export interface FileBytes {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

// Codes the S3/MinIO client surfaces when the object store is simply not there.
// An AggregateError wraps them when the host resolves to several addresses.
const OUTAGE_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
]);

function isStorageOutage(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; errors?: unknown; cause?: unknown; name?: unknown };
  if (typeof candidate.code === "string" && OUTAGE_CODES.has(candidate.code)) return true;
  if (Array.isArray(candidate.errors)) return candidate.errors.some(isStorageOutage);
  if (candidate.cause) return isStorageOutage(candidate.cause);
  return false;
}

/**
 * The object store being down is a 503 with a name the client can act on, not
 * an unhandled 500 — that is what lets the UI keep a half-written diary entry
 * and say "storage is unavailable" instead of "Internal server error".
 */
async function throughStorage<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isStorageOutage(error)) {
      throw new ServiceUnavailableError(
        "File storage is unavailable right now. Your text is safe — try attaching the file again shortly.",
        "storage_unavailable",
      );
    }
    throw error;
  }
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
      const stored: StoredFile = await throughStorage(() => saveStream(ownerId, incoming.data));
      const row = await repository.create({
        id: generateId("file"),
        owner_id: ownerId,
        project_id: incoming.projectId ?? null,
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

    findRow(id: string): Promise<UploadedFileRow | undefined> {
      return repository.findById(id);
    },

    findRows(ids: string[]): Promise<UploadedFileRow[]> {
      return repository.findByIds(ids);
    },

    async presignViewUrl(
      row: UploadedFileRow,
      disposition: "inline" | "attachment" = "inline",
    ): Promise<string> {
      return throughStorage(() =>
        getDownloadUrl(row.storage_path, 900, {
          disposition,
          fileName: row.file_name,
          contentType: row.mime_type,
        }),
      );
    },

    /**
     * What the bytes say the file is, for the few types a caller must be sure
     * of; the client-sent mime type is a label, not proof. Returns null for
     * anything else.
     */
    async sniffMimeType(row: UploadedFileRow): Promise<"image/png" | "image/jpeg" | "application/pdf" | null> {
      const stream = await throughStorage(() => openStoredFile(row.storage_path));
      const head = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          size += chunk.length;
          if (size >= 8) {
            (stream as unknown as { destroy?: () => void }).destroy?.();
            resolve(Buffer.concat(chunks).subarray(0, 8));
          }
        });
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
      });
      if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
      if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
      if (head.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
      return null;
    },

    async open(row: UploadedFileRow): Promise<DownloadHandle> {
      const stream = await throughStorage(() => openStoredFile(row.storage_path));
      return {
        fileName: row.file_name,
        mimeType: row.mime_type,
        sizeBytes: Number(row.size_bytes),
        stream,
      };
    },

    // Server-side byte read with no per-user ownership check. Only for trusted
    // internal callers (e.g. report rendering) where the file id originates from
    // content the project already owns — never expose this to a request handler
    // without an upstream project-scoped authorization check.
    async readBytes(id: string): Promise<FileBytes | null> {
      const row = await repository.findById(id);
      if (!row) return null;
      const stream = await throughStorage(() => openStoredFile(row.storage_path));
      const bytes = await throughStorage(() => streamToBuffer(stream));
      return { fileName: row.file_name, mimeType: row.mime_type, bytes };
    },
  };
}

export type FilesService = ReturnType<typeof filesService>;
