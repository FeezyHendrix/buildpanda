import api from "./client";
import type { UploadedFile } from "@/lib/project-types";

/** Reports upload progress as an integer percentage in the range 0–100. */
export type UploadProgressHandler = (percent: number) => void;

export const filesApi = {
  /**
   * Upload a single file to /files and return its metadata.
   *
   * Content-Type is set to `undefined` (not "multipart/form-data") so axios
   * drops the instance's default application/json and lets the browser generate
   * the `multipart/form-data; boundary=…` header. A hardcoded value omits the
   * boundary, which makes @fastify/multipart reject the upload.
   *
   * `timeout: 0` overrides the axios instance's 15s default — large files (the
   * backend accepts up to UPLOAD_MAX_BYTES, 25MB) routinely take longer than
   * 15s and would otherwise abort with ECONNABORTED and no real feedback.
   *
   * `onProgress` receives byte-level progress so callers can render a progress
   * bar. When the total size is unknown (no Content-Length on the request
   * body), axios omits `event.total`; we skip those ticks rather than report a
   * bogus 0.
   *
   * `projectId` (when supplied) must precede the file part: @fastify/multipart
   * only exposes sibling text fields on `request.file()` when they arrive
   * before the stream.
   */
  upload: (
    file: File,
    onProgress?: UploadProgressHandler,
    projectId?: string,
  ): Promise<UploadedFile> => {
    const form = new FormData();
    if (projectId) form.append("projectId", projectId);
    form.append("file", file);
    return api
      .post<UploadedFile>("/files", form, {
        headers: { "Content-Type": undefined },
        timeout: 0,
        onUploadProgress: (event) => {
          if (!onProgress || !event.total) return;
          onProgress(Math.round((event.loaded / event.total) * 100));
        },
      })
      .then((r) => r.data);
  },

  /** Resolve a short-lived signed URL for viewing/streaming a stored file. */
  resolveUrl: (fileId: string): Promise<string> =>
    api.get<{ url: string }>(`/files/${fileId}/url`).then((r) => r.data.url),

  downloadUrl: (fileId: string): string =>
    `${api.defaults.baseURL ?? ""}/files/${fileId}/download`,
};
