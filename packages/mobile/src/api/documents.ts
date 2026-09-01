import { API_BASE_URL } from "@/lib/auth-client";
import { uploadProjectFile } from "./files";
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

  /**
   * The version endpoint streams the file bytes (Content-Type of the document,
   * not JSON), so callers download from this URL with the auth cookie header —
   * there is no presigned-URL hop.
   */
  versionDownloadUrl: (projectId: string, documentId: string, versionId: string) =>
    `${API_BASE_URL}/projects/${projectId}/documents/${documentId}/versions/${versionId}/view`,
  versions: (projectId: string, documentId: string) =>
    request<DocumentVersion[]>(`/projects/${projectId}/documents/${documentId}/versions`),

  /** Multipart file upload — can't use the generic request() helper. */
  uploadFile: uploadProjectFile,

  createDocument: (projectId: string, body: { categoryId: string; fileId: string; fileName: string; size: string }) =>
    request<ProjectDocument>(`/projects/${projectId}/documents`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
