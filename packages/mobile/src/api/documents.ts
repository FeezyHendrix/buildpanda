import {
  cacheDirectory,
  copyAsync,
  FileSystemUploadType,
  makeDirectoryAsync,
  uploadAsync,
} from "expo-file-system/legacy";
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
    const headers: Record<string, string> = {};
    if (Platform.OS !== "web") headers.cookie = authClient.getCookie();

    // uploadAsync derives the multipart filename from the file's basename, so stage
    // the pick under its real name first (the picker's cache path uses a generated
    // one). Native multipart because RN FormData rejects the file part — see
    // api/voice-report.ts.
    const safeName = fileName.replace(/[/\\]/g, "_");
    const dir = `${cacheDirectory ?? ""}bp-upload-${Date.now()}/`;
    await makeDirectoryAsync(dir, { intermediates: true });
    const stagedUri = `${dir}${safeName}`;
    await copyAsync({ from: uri, to: stagedUri });

    const result = await uploadAsync(`${API_BASE_URL}/files`, stagedUri, {
      httpMethod: "POST",
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType,
      parameters: { projectId },
      headers,
    });

    if (result.status < 200 || result.status >= 300) throw new Error(`Upload failed (${result.status})`);
    return JSON.parse(result.body) as { id: string; fileName: string; sizeBytes: number };
  },

  createDocument: (projectId: string, body: { categoryId: string; fileId: string; fileName: string; size: string }) =>
    request<ProjectDocument>(`/projects/${projectId}/documents`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
