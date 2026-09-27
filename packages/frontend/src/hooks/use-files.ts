import { useMutation, useQuery } from "@tanstack/react-query";
import { filesApi, type UploadProgressHandler } from "@/api/files";
import type { UploadedFile } from "@/lib/project-types";
import { fileKeys } from "./query-keys";

export type { UploadProgressHandler };

export function uploadFileRequest(
  file: File,
  onProgress?: UploadProgressHandler,
  projectId?: string,
): Promise<UploadedFile> {
  return filesApi.upload(file, onProgress, projectId);
}

export interface UploadFileVariables {
  file: File;
  onProgress?: UploadProgressHandler;
  projectId?: string;
}

export function useUploadFile() {
  return useMutation({
    mutationFn: ({ file, onProgress, projectId }: UploadFileVariables) =>
      filesApi.upload(file, onProgress, projectId),
  });
}

export function resolveFileUrl(fileId: string): Promise<string> {
  return filesApi.resolveUrl(fileId);
}

/** Signed URL for streaming a stored file (voice/video notes, previews); short-lived, so kept fresh. */
export function useFileUrl(fileId: string | null | undefined) {
  return useQuery({
    queryKey: fileKeys.url(fileId ?? "__none__"),
    queryFn: () => filesApi.resolveUrl(fileId!),
    enabled: Boolean(fileId),
    staleTime: 5 * 60 * 1000,
  });
}
