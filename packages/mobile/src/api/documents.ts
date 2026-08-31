import { Platform } from "react-native";
import { API_BASE_URL, authClient } from "@/lib/auth-client";
import { request } from "./client";

export type DocumentGroup = "plan" | "document";

export interface ProjectDocument {
  id: string;
  fileName: string;
  size: string;
  category?: string | null;
  group?: DocumentGroup;
  status?: string;
  versionNo?: number;
  currentVersionId?: string | null;
  uploadedAt?: string;
}

export interface DocumentCategory {
  id: string;
  name: string;
  fileCount: number;
  totalSize: string;
  tone: string;
  group: DocumentGroup;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNo: number;
  revisionLabel: string | null;
  fileName: string;
  size: string;
  notes: string | null;
  isCurrent: boolean;
  createdAt: string;
}

export const documentsApi = {
  categories: (projectId: string) =>
    request<DocumentCategory[]>(`/projects/${projectId}/documents/categories`),

  list: (projectId: string) => request<ProjectDocument[]>(`/projects/${projectId}/documents`),

  /** Presigned URL for a specific version, used to cache the file for offline. */
  versionViewUrl: (projectId: string, documentId: string, versionId: string) =>
    request<{ url: string }>(
      `/projects/${projectId}/documents/${documentId}/versions/${versionId}/view`,
    ),
  versions: (projectId: string, documentId: string) =>
    request<DocumentVersion[]>(`/projects/${projectId}/documents/${documentId}/versions`),

  /** Multipart file upload — can't use the generic request() helper. */
  uploadFile: async (projectId: string, uri: string, fileName: string, mimeType: string): Promise<{ id: string; fileName: string; sizeBytes: number }> => {
    const form = new FormData();
    form.append("file", { uri, name: fileName, type: mimeType } as never);
    form.append("projectId", projectId);

    const headers: Record<string, string> = {};
    if (Platform.OS !== "web") headers.cookie = authClient.getCookie();

    const response = await fetch(`${API_BASE_URL}/files`, {
      method: "POST",
      credentials: "include",
      headers,
      body: form,
    });

    if (!response.ok) throw new Error(`Upload failed (${response.status})`);
    return (await response.json()) as { id: string; fileName: string; sizeBytes: number };
  },

  createDocument: (projectId: string, body: { categoryId: string; fileId: string; fileName: string; size: string }) =>
    request<ProjectDocument>(`/projects/${projectId}/documents`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
