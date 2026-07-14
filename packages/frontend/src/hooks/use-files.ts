import { useMutation } from "@tanstack/react-query";
import { filesApi, type UploadProgressHandler } from "@/api/files";
import type { UploadedFile } from "@/lib/project-types";

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
