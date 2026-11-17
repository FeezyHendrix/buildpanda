import type { FilesService } from "../files/service.ts";
import type { MessagingAdapterRegistry } from "./channel-types.ts";
import type { draftDailyActions } from "./draft.ts";

export interface MessagingAttachmentIdentity {
  providerId: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface MessagingSourceFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MessagingUploadOptions {
  adapters?: MessagingAdapterRegistry;
  files?: Pick<FilesService, "upload">;
  draft?: typeof draftDailyActions;
}
