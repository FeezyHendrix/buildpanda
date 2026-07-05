import api from "./client";
import type {
  BimCoordinationIssue,
  BimModel,
  BimUploadTicket,
} from "@/lib/project-types";

export interface CompleteUploadInput {
  storagePath: string;
  uploadId: string;
  parts: { partNumber: number; etag: string }[];
}

export interface CreateModelInput {
  name: string;
  discipline: string | null;
  fileName: string;
  storagePath: string;
  sizeBytes: number;
}

export interface CreateBimIssueInput {
  title: string;
  description?: string | null;
  elementGuid?: string | null;
  assigneeId?: string | null;
}

export async function uploadSingle(url: string, file: File): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

export async function uploadMultipart(
  parts: { partNumber: number; url: string }[],
  partSize: number,
  file: File,
): Promise<{ partNumber: number; etag: string }[]> {
  const results: { partNumber: number; etag: string }[] = [];
  for (const part of parts) {
    const start = (part.partNumber - 1) * partSize;
    const chunk = file.slice(start, Math.min(start + partSize, file.size));
    const res = await fetch(part.url, { method: "PUT", body: chunk });
    if (!res.ok) throw new Error(`Part ${part.partNumber} upload failed (${res.status})`);
    const etag = res.headers.get("ETag") ?? res.headers.get("etag") ?? "";
    results.push({ partNumber: part.partNumber, etag: etag.replace(/"/g, "") });
  }
  return results;
}

export const bimApi = {
  getModels: (projectId: string) =>
    api.get<BimModel[]>(`/projects/${projectId}/bim/models`).then((r) => r.data),

  getModel: (projectId: string, modelId: string) =>
    api.get<BimModel>(`/projects/${projectId}/bim/models/${modelId}`).then((r) => r.data),

  getIssues: (projectId: string, modelId: string) =>
    api.get<BimCoordinationIssue[]>(`/projects/${projectId}/bim/models/${modelId}/issues`).then((r) => r.data),

  getUploadUrl: (projectId: string, fileName: string, sizeBytes: number) =>
    api.post<BimUploadTicket>(`/projects/${projectId}/bim/upload-url`, { fileName, sizeBytes }).then((r) => r.data),

  completeUpload: (projectId: string, body: CompleteUploadInput) =>
    api.post(`/projects/${projectId}/bim/complete-upload`, body).then((r) => r.data),

  createModel: (projectId: string, body: CreateModelInput) =>
    api.post<BimModel>(`/projects/${projectId}/bim/models`, body).then((r) => r.data),

  getFileUrl: (projectId: string, modelId: string) =>
    api.get<{ url: string; fileName: string }>(`/projects/${projectId}/bim/models/${modelId}/file-url`).then((r) => r.data),

  getXktUrl: (projectId: string, modelId: string) =>
    api.get<{ url: string | null; status: string }>(`/projects/${projectId}/bim/models/${modelId}/xkt-url`).then((r) => r.data),

  createIssue: (projectId: string, modelId: string, body: CreateBimIssueInput) =>
    api.post<BimCoordinationIssue>(`/projects/${projectId}/bim/models/${modelId}/issues`, body).then((r) => r.data),

  promoteIssueToRfi: (projectId: string, modelId: string, issueId: string) =>
    api.post<BimCoordinationIssue>(`/projects/${projectId}/bim/models/${modelId}/issues/${issueId}/promote-to-rfi`).then((r) => r.data),
};
