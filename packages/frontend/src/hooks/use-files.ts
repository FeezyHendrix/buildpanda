import { useMutation } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { UploadedFile } from "@/lib/project-types";

/** Reports upload progress as an integer percentage in the range 0–100. */
export type UploadProgressHandler = (percent: number) => void;

/**
 * Upload a single file to /files and return its metadata.
 *
 * Content-Type is set to `undefined` (not "multipart/form-data") so axios drops
 * the instance's default application/json and lets the browser generate the
 * `multipart/form-data; boundary=…` header. A hardcoded value omits the
 * boundary, which makes @fastify/multipart reject the upload.
 *
 * `timeout: 0` overrides the axios instance's 15s default — large files (the
 * backend accepts up to UPLOAD_MAX_BYTES, 25MB) routinely take longer than 15s
 * and would otherwise abort with ECONNABORTED and no real feedback.
 *
 * `onProgress` receives byte-level progress so callers can render a progress
 * bar. When the total size is unknown (no Content-Length on the request body),
 * axios omits `event.total`; we skip those ticks rather than report a bogus 0.
 *
 * Exported as a plain function so non-hook flows (e.g. project creation) can
 * reuse it without calling a hook inside a callback.
 */
export async function uploadFileRequest(
  file: File,
  onProgress?: UploadProgressHandler,
): Promise<UploadedFile> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<UploadedFile>("/files", form, {
    headers: { "Content-Type": undefined },
    timeout: 0,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data;
}

/** Mutation variables for {@link useUploadFile}. */
export interface UploadFileVariables {
  file: File;
  onProgress?: UploadProgressHandler;
}

export function useUploadFile() {
  return useMutation({
    mutationFn: ({ file, onProgress }: UploadFileVariables) =>
      uploadFileRequest(file, onProgress),
  });
}
