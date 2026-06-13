import { useMutation } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { UploadedFile } from "@/lib/project-types";

/**
 * Upload a single file to /files and return its metadata.
 *
 * Content-Type is set to `undefined` (not "multipart/form-data") so axios drops
 * the instance's default application/json and lets the browser generate the
 * `multipart/form-data; boundary=…` header. A hardcoded value omits the
 * boundary, which makes @fastify/multipart reject the upload.
 *
 * Exported as a plain function so non-hook flows (e.g. project creation) can
 * reuse it without calling a hook inside a callback.
 */
export async function uploadFileRequest(file: File): Promise<UploadedFile> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<UploadedFile>("/files", form, {
    headers: { "Content-Type": undefined },
  });
  return data;
}

export function useUploadFile() {
  return useMutation({ mutationFn: uploadFileRequest });
}
